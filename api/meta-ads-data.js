// /api/meta-ads-data
// Serverless proxy to Meta Graph API v25.0 for the Ads Command Center.
// All requests require Authorization: Bearer <ADMIN_PASSWORD>.
//
// Env vars (set in Vercel):
//   ADMIN_PASSWORD       — gate password (rotate to revoke access)
//   META_ACCESS_TOKEN    — long-lived Meta token (Page > User token with ads_read scope)
//   META_AD_ACCOUNT_ID   — numeric ID (without "act_" prefix is OK, we'll add it)
//   META_PIXEL_ID        — numeric Pixel ID
//   META_PAGE_ID         — numeric FB Page ID
//
// Defensive: if env is missing, returns {ok:true, noop:true, reason:'env_missing'} (200).
// On Meta API errors: returns {ok:false, error:'meta_api_error', detail:'...'} (200).
// On wrong password: returns 401.

const GRAPH = 'https://graph.facebook.com/v25.0';

// Use last 30 days for insights (date_preset=last_30d would also work, but explicit range is clearer)
const INSIGHT_FIELDS = 'spend,impressions,clicks,ctr,cpc,cpm,reach,actions,cost_per_action_type';
const DATE_PRESET = 'maximum'; // lifetime since campaign creation

function unauthorized(res) {
  res.status(401).json({ ok: false, error: 'unauthorized' });
}

function noop(res, reason) {
  res.status(200).json({ ok: true, noop: true, reason });
}

function apiError(res, detail) {
  res.status(200).json({ ok: false, error: 'meta_api_error', detail: String(detail).slice(0, 500) });
}

async function metaGet(path, params = {}, accessToken) {
  const url = new URL(GRAPH + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', accessToken);
  const r = await fetch(url.toString());
  const data = await r.json();
  if (data.error) throw new Error(`${data.error.type || 'GraphError'}: ${data.error.message}`);
  return data;
}

function actId(raw) {
  const s = String(raw).trim();
  return s.startsWith('act_') ? s : `act_${s}`;
}

// Parse Meta `actions` array into a single conversion count.
// We look for purchase / lead / offsite_conversion events.
function extractConversions(insights, optimizationGoal) {
  if (!insights || !insights.actions) return { conv: 0, cpa: null };

  // Priority by goal
  const goalToAction = {
    OFFSITE_CONVERSIONS: ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'],
    LEAD_GENERATION: ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'],
    LINK_CLICKS: ['link_click'],
    CONVERSIONS: ['purchase', 'offsite_conversion.fb_pixel_purchase'],
    PURCHASE: ['purchase'],
    LEAD: ['lead']
  };

  const goal = (optimizationGoal || '').toUpperCase();
  const wanted = goalToAction[goal] || ['purchase', 'lead', 'offsite_conversion.fb_pixel_purchase', 'offsite_conversion.fb_pixel_lead'];

  let conv = 0;
  for (const w of wanted) {
    const match = insights.actions.find(a => a.action_type === w);
    if (match) { conv = parseInt(match.value, 10); break; }
  }

  let cpa = null;
  if (insights.cost_per_action_type) {
    for (const w of wanted) {
      const match = insights.cost_per_action_type.find(a => a.action_type === w);
      if (match) { cpa = parseFloat(match.value); break; }
    }
  }

  return { conv, cpa };
}

function flattenInsights(raw, optimizationGoal) {
  if (!raw) return null;
  const ins = raw.data && raw.data[0] ? raw.data[0] : raw;
  const { conv, cpa } = extractConversions(ins, optimizationGoal);
  return {
    spend: ins.spend || 0,
    impressions: ins.impressions || 0,
    clicks: ins.clicks || 0,
    ctr: ins.ctr || 0,
    cpc: ins.cpc || 0,
    cpm: ins.cpm || 0,
    reach: ins.reach || 0,
    conversions: conv,
    cost_per_conversion: cpa
  };
}

// Optimization event label for the UI header
function optimizationLabel(goal) {
  const map = {
    OFFSITE_CONVERSIONS: 'Purchase',
    LEAD_GENERATION: 'Lead',
    LINK_CLICKS: 'Link Clicks',
    POST_ENGAGEMENT: 'Engagement',
    REACH: 'Reach',
    IMPRESSIONS: 'Impressions',
    LANDING_PAGE_VIEWS: 'Landing Page View',
    CONVERSIONS: 'Conversion',
    PURCHASE: 'Purchase',
    LEAD: 'Lead'
  };
  return map[(goal || '').toUpperCase()] || 'Conversion';
}

export default async function handler(req, res) {
  // CORS / method guard
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  // Password gate
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) {
    return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD env var not set' });
  }
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/);
  if (!match || match[1].trim() !== adminPw) {
    return unauthorized(res);
  }

  // Env check
  const token = process.env.META_ACCESS_TOKEN;
  const adAccountRaw = process.env.META_AD_ACCOUNT_ID;
  if (!token || !adAccountRaw) {
    return noop(res, 'meta_env_missing');
  }
  const adAccount = actId(adAccountRaw);
  const endpoint = (req.query.endpoint || '').toString();

  try {
    if (endpoint === 'token') {
      // Use /debug_token to get expiry
      try {
        const debug = await metaGet('/debug_token', { input_token: token }, token);
        const info = debug.data || {};
        return res.status(200).json({
          ok: true,
          token_info: {
            expires_at: info.expires_at || 0,
            scopes: info.scopes || [],
            is_valid: info.is_valid || false
          }
        });
      } catch (e) {
        return res.status(200).json({ ok: true, token_info: { expires_at: 0, is_valid: false } });
      }
    }

    if (endpoint === 'campaign') {
      // Get most recent active campaign from the ad account
      const camps = await metaGet(`/${adAccount}/campaigns`, {
        fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,objective,created_time,start_time',
        limit: 5,
        sort: 'created_time_descending'
      }, token);

      if (!camps.data || camps.data.length === 0) {
        return res.status(200).json({ ok: true, campaign: null, insights: null, optimization_event: 'Conversion' });
      }

      // Pick the first ACTIVE one if any, else most recent
      const active = camps.data.find(c => (c.effective_status || '').toUpperCase() === 'ACTIVE');
      const campaign = active || camps.data[0];

      // Get insights for this campaign
      let insights = null;
      try {
        const ins = await metaGet(`/${campaign.id}/insights`, {
          fields: INSIGHT_FIELDS,
          date_preset: DATE_PRESET
        }, token);
        insights = flattenInsights(ins, campaign.objective);
      } catch (e) {
        // Insights may fail if campaign has no data — that's fine, return zeros
      }

      return res.status(200).json({
        ok: true,
        campaign,
        insights,
        optimization_event: optimizationLabel(campaign.objective)
      });
    }

    if (endpoint === 'adsets') {
      const sets = await metaGet(`/${adAccount}/adsets`, {
        fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,campaign_id,created_time',
        limit: 25
      }, token);

      const adsets = sets.data || [];

      // Get insights + ad counts for each adset in parallel
      const enriched = await Promise.all(adsets.map(async (a) => {
        const [insightsRes, adsCount] = await Promise.all([
          metaGet(`/${a.id}/insights`, { fields: INSIGHT_FIELDS, date_preset: DATE_PRESET }, token).catch(() => null),
          metaGet(`/${a.id}/ads`, { fields: 'id', limit: 50 }, token).catch(() => ({ data: [] }))
        ]);
        return {
          ...a,
          insights: flattenInsights(insightsRes, a.optimization_goal),
          ads_count: (adsCount.data || []).length
        };
      }));

      return res.status(200).json({ ok: true, adsets: enriched });
    }

    if (endpoint === 'ads') {
      const ads = await metaGet(`/${adAccount}/ads`, {
        fields: 'id,name,status,effective_status,adset_id,creative{id,image_url,thumbnail_url,object_story_spec,body,title,call_to_action_type}',
        limit: 50
      }, token);

      // Build adset_id → adset_name map
      const adsetsRes = await metaGet(`/${adAccount}/adsets`, { fields: 'id,name,optimization_goal', limit: 25 }, token).catch(() => ({ data: [] }));
      const adsetMap = {};
      (adsetsRes.data || []).forEach(a => { adsetMap[a.id] = a; });

      const list = ads.data || [];

      // Get insights for each ad in parallel
      const enriched = await Promise.all(list.map(async (ad) => {
        const adset = adsetMap[ad.adset_id] || {};
        const ins = await metaGet(`/${ad.id}/insights`, { fields: INSIGHT_FIELDS, date_preset: DATE_PRESET }, token).catch(() => null);

        const creative = ad.creative || {};
        const story = creative.object_story_spec || {};
        const linkData = story.link_data || story.video_data || {};

        return {
          id: ad.id,
          name: ad.name,
          status: ad.status,
          effective_status: ad.effective_status,
          adset_id: ad.adset_id,
          adset_name: adset.name || null,
          creative_title: creative.title || linkData.name || null,
          creative_body: creative.body || linkData.message || null,
          image_url: creative.image_url || creative.thumbnail_url || linkData.picture || null,
          cta_type: creative.call_to_action_type || (linkData.call_to_action ? linkData.call_to_action.type : null),
          insights: flattenInsights(ins, adset.optimization_goal)
        };
      }));

      return res.status(200).json({ ok: true, ads: enriched });
    }

    return res.status(400).json({ ok: false, error: 'unknown_endpoint', detail: 'endpoint must be one of: campaign, adsets, ads, token' });
  } catch (err) {
    console.error('[meta-ads-data] Error:', err);
    return apiError(res, err.message || err);
  }
}
