import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WEIGHTS, blendScore, profileCompleteness, rankJobs, scoreCourse, scoreJob, scoreRental } from '../src/lib/ai-matching/scoring.ts';
import { buildJobEmbeddingText, buildProfileEmbeddingText, contentHash, cosineSimilarity, embedTexts, getEmbeddingConfig } from '../src/lib/ai-matching/embeddings.ts';

const profile = { industryKey: 'may mac', workProvinceCode: 'BD', homeProvinceCode: null, kcnId: null, salaryMin: 8_000_000, experienceYears: 2, shift: 'day', needsHousing: true };
const job = (over = {}) => ({ id: 'j1', industryKey: 'may mac', provinceCode: 'BD', kcnId: null, salaryMin: 8_000_000, salaryMax: 12_000_000, shiftType: 'day', hasHousing: true, noExperienceRequired: false, isUrgent: false, createdAt: '2026-10-20T00:00:00Z', ...over });

test('weights add up to 100 and a perfect match scores 100 with every reason', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  const result = scoreJob({ ...profile, workProvinceCode: null, kcnId: 'k1' }, job({ kcnId: 'k1' }));
  assert.equal(result.score, 100);
  assert.equal(result.coverage, 1);
  assert.deepEqual([...result.reasons].sort(), ['experience_fit', 'has_housing', 'salary_fit', 'same_industry', 'same_kcn', 'same_shift']);
});

test('missing profile fields are excluded instead of counted as a mismatch', () => {
  const sparse = { industryKey: 'may mac', workProvinceCode: null, homeProvinceCode: null, kcnId: null, salaryMin: null, experienceYears: null, shift: null, needsHousing: null };
  const result = scoreJob(sparse, job());
  assert.equal(result.score, 100);
  assert.equal(result.coverage, 0.3);
  const none = scoreJob({ ...sparse, industryKey: null }, job());
  assert.equal(none.score, 0);
  assert.equal(none.coverage, 0);
  assert.deepEqual(profileCompleteness(sparse), { filled: 1, total: 6, missing: ['location', 'salary', 'experience', 'shift', 'housing'] });
});

test('industry, location, salary, shift and housing react to real differences', () => {
  assert.equal(scoreJob(profile, job({ industryKey: 'dien tu' })).reasons.includes('same_industry'), false);
  assert.ok(scoreJob(profile, job({ industryKey: 'may mac giay da' })).reasons.includes('similar_industry'));
  const home = { ...profile, workProvinceCode: null, homeProvinceCode: 'BD' };
  assert.ok(scoreJob(home, job()).reasons.includes('home_province'));
  assert.ok(scoreJob(profile, job()).reasons.includes('work_province'));
  assert.equal(scoreJob(profile, job({ provinceCode: 'HN' })).reasons.includes('work_province'), false);
  assert.equal(scoreJob(profile, job({ salaryMax: 5_000_000, salaryMin: 4_000_000 })).reasons.includes('salary_fit'), false);
  const partial = scoreJob({ ...profile, needsHousing: null, shift: null, experienceYears: null, workProvinceCode: null, industryKey: null }, job({ salaryMax: 7_600_000, salaryMin: 7_000_000 }));
  assert.ok(partial.score > 0 && partial.score < 100);
  assert.ok(scoreJob({ ...profile, shift: 'flexible' }, job({ shiftType: 'night' })).reasons.includes('same_shift'));
  assert.equal(scoreJob({ ...profile, needsHousing: false }, job({ hasHousing: false })).reasons.includes('has_housing'), false);
});

test('ranking is deterministic: score, then urgent, then newest, then id', () => {
  const jobs = [job({ id: 'a', industryKey: 'dien tu' }), job({ id: 'b' }), job({ id: 'c', isUrgent: true }), job({ id: 'd', createdAt: '2026-10-25T00:00:00Z' })];
  const ranked = rankJobs(profile, jobs);
  assert.deepEqual(ranked.map(item => item.job.id), ['c', 'd', 'b', 'a']);
  assert.deepEqual(rankJobs(profile, jobs, new Map(), 90).map(item => item.job.id), ['c', 'd', 'b']);
});

test('semantic similarity only nudges the structured score and never replaces it', () => {
  assert.equal(blendScore(80, null), 80);
  assert.equal(blendScore(80, Number.NaN), 80);
  assert.equal(blendScore(80, 1), 84);
  assert.equal(blendScore(80, 0), 64);
  assert.equal(blendScore(80, 5), 84);
  const ranked = rankJobs(profile, [job({ id: 'a' }), job({ id: 'b' })], new Map([['a', 0.9]]));
  assert.ok(ranked.find(item => item.job.id === 'a').reasons.includes('similar_content'));
  assert.equal(ranked.find(item => item.job.id === 'b').reasons.includes('similar_content'), false);
});

test('service scoring uses province, nearby zone, industry and never invents needs', () => {
  const rental = scoreRental(profile, { provinceCode: 'BD', nearbyZone: 'KCN VSIP 1', monthlyRentVnd: 1_500_000 }, 'vsip');
  assert.deepEqual(rental.reasons, ['same_province', 'near_work_place', 'needs_housing']);
  assert.equal(scoreRental({ ...profile, workProvinceCode: null }, { provinceCode: 'BD', nearbyZone: null, monthlyRentVnd: 1 }, null).score, 10);
  const course = scoreCourse(profile, { provinceCode: 'BD', occupationKey: 'may mac cong nghiep', learningMode: 'onsite' });
  assert.deepEqual(course.reasons, ['industry_training', 'same_province']);
  assert.equal(scoreCourse({ ...profile, industryKey: null }, { provinceCode: 'HN', occupationKey: 'may mac', learningMode: 'onsite' }).reasons.length, 0);
});

test('embedding texts carry no personal identifiers and hashes are stable', () => {
  const text = buildProfileEmbeddingText({ industry: 'May mặc', provinceName: 'Bình Dương', kcnName: null, shift: 'night', needsHousing: true, experienceYears: 3 });
  assert.match(text, /Ngành nghề mong muốn: May mặc/);
  assert.match(text, /ca đêm/);
  assert.match(text, /Cần hỗ trợ nhà ở/);
  assert.doesNotMatch(text, /@|\d{9,}/);
  assert.equal(buildProfileEmbeddingText({ industry: null, provinceName: null, kcnName: null, shift: null, needsHousing: null, experienceYears: null }), '');
  assert.ok(buildJobEmbeddingText({ title: 'T', description: 'x'.repeat(5000), requirements: null, industry: 'I', location: 'L' }).length < 1500);
  assert.equal(contentHash('a'), contentHash('a'));
  assert.notEqual(contentHash('a'), contentHash('b'));
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1], [1, 2]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});

test('Gemini embedding call is off without a key, validates the reply and swallows every failure', async () => {
  assert.equal(getEmbeddingConfig({}).enabled, false);
  assert.equal(getEmbeddingConfig({ GEMINI_API_KEY: 'test-key', AI_MATCHING_SEMANTIC: 'off' }).enabled, false);
  const config = getEmbeddingConfig({ GEMINI_API_KEY: 'test-key', GEMINI_EMBEDDING_MODEL: 'gemini-embedding-2' });
  assert.equal(config.enabled, true);
  assert.equal(config.model, 'gemini-embedding-2');

  const calls = [];
  const good = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }] }) }; };
  assert.deepEqual(await embedTexts(['a', 'b'], config, good), [[0.1, 0.2], [0.3, 0.4]]);
  assert.match(calls[0].url, /gemini-embedding-2:batchEmbedContents$/);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'test-key');
  assert.doesNotMatch(calls[0].url, /key=/, 'the key must travel in a header, not the URL');

  assert.equal(await embedTexts(['a'], getEmbeddingConfig({}), good), null);
  assert.equal(await embedTexts([], config, good), null);
  assert.equal(await embedTexts(['a', 'b'], config, async () => ({ ok: false, json: async () => ({}) })), null);
  assert.equal(await embedTexts(['a', 'b'], config, async () => ({ ok: true, json: async () => ({ embeddings: [{ values: [1] }] }) })), null, 'wrong count');
  assert.equal(await embedTexts(['a'], config, async () => ({ ok: true, json: async () => ({ embeddings: [{ values: ['x'] }] }) })), null, 'non-numeric');
  assert.equal(await embedTexts(['a'], config, async () => { throw new Error('offline'); }), null);
  const hang = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  assert.equal(await embedTexts(['a'], { ...config, timeoutMs: 5 }, hang), null);
});

test('embedding size is limited by default and is part of the cache key', async () => {
  const base = { GEMINI_API_KEY: 'test-key' };
  assert.equal(getEmbeddingConfig(base).dimensions, 768);
  assert.equal(getEmbeddingConfig(base).cacheKey, 'gemini-embedding-001@768');
  assert.equal(getEmbeddingConfig({ ...base, GEMINI_EMBEDDING_DIMENSIONS: '256' }).cacheKey, 'gemini-embedding-001@256');
  assert.equal(getEmbeddingConfig({ ...base, GEMINI_EMBEDDING_DIMENSIONS: '0' }).cacheKey, 'gemini-embedding-001');
  for (const bad of ['abc', '-5', '99999', '12.5']) assert.equal(getEmbeddingConfig({ ...base, GEMINI_EMBEDDING_DIMENSIONS: bad }).dimensions, 768, bad);

  const bodies = [];
  const capture = async (url, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ embeddings: [{ values: [1, 2] }] }) }; };
  await embedTexts(['a'], getEmbeddingConfig({ ...base, GEMINI_EMBEDDING_DIMENSIONS: '256' }), capture);
  assert.equal(bodies[0].requests[0].outputDimensionality, 256);
  await embedTexts(['a'], getEmbeddingConfig({ ...base, GEMINI_EMBEDDING_DIMENSIONS: '0' }), capture);
  assert.equal('outputDimensionality' in bodies[1].requests[0], false, 'zero keeps the model default');
});
