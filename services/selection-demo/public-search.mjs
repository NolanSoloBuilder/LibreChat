const metadataUrl = 'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token';

export async function searchPublicWeb(query, { fetchImpl = fetch, project = process.env.GOOGLE_CLOUD_PROJECT } = {}) {
  if (!project) throw Error('PUBLIC_SEARCH_NOT_CONFIGURED');
  const authResponse = await fetchImpl(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(5000),
  });
  if (!authResponse.ok) throw Error('PUBLIC_SEARCH_AUTH_UNAVAILABLE');
  const { access_token: accessToken } = await authResponse.json();
  if (!accessToken) throw Error('PUBLIC_SEARCH_AUTH_UNAVAILABLE');

  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/global/publishers/google/models/gemini-3.1-pro-preview:generateContent`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `Search the public web for: ${query}. Answer briefly and use only search-grounded findings. If results are weak, say so.` }] }],
      tools: [{ googleSearch: {} }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw Error(`PUBLIC_SEARCH_PROVIDER_${response.status}`);
  const result = await response.json();
  const candidate = result.candidates?.[0];
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const sourceMap = new Map();
  for (const { web } of chunks) {
    if (!web?.uri?.startsWith('https://')) continue;
    if (!sourceMap.has(web.uri)) sourceMap.set(web.uri, { title: web.title ?? web.domain ?? 'Public source', url: web.uri, domain: web.domain ?? null });
  }
  const sources = [...sourceMap.values()].slice(0, 8);
  if (!sources.length) throw Error('PUBLIC_SEARCH_NO_GROUNDED_SOURCES');
  return {
    data_mode: 'public_search',
    source_type: 'Vertex AI Google Search grounding',
    searched_at: new Date().toISOString(),
    query,
    summary: candidate.content?.parts?.filter((part) => typeof part.text === 'string').map((part) => part.text).join('\n').slice(0, 4000) ?? '',
    sources,
  };
}
