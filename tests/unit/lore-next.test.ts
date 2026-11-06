import { describe, expect, it } from 'vitest';
import current from '@fixtures/publication/lore-release.json';
import next from '@fixtures/publication/lore-release-next.json';
import { GM, clone, setup } from './helpers';
import { recordId } from '@/lib/contract/ids';
import { EXISTING } from '../../lore/catalog';
import { PROJECT } from './helpers';

async function applyNext(afterCurrent = false) {
  const { store, publication } = await setup();
  if (afterCurrent) await publication.publish(clone(current), GM);
  const base = await store.getActiveState();
  const bundle = { ...clone(next), baseReleaseId: base.releaseId, ...(afterCurrent ? {releaseId:recordId(PROJECT,"release/test-current-refresh")} : {}) };
  const preview = await publication.preview(bundle);
  expect(preview.issues.filter(i => i.severity === 'error')).toEqual([]);
  expect((await publication.publish(bundle, GM)).status).toBe('applied');
  return { store, publication };
}

describe('complete Ilyr source pack (staged, not automatically published)', () => {
  it.each([false, true])('validates against seed or existing lore (existing=%s)', async existing => {
    const { store } = await applyNext(existing);
    const state = await store.getActiveState();
    const peoples = Object.values(state.records).filter(s => s.lifecycle === 'active' && s.record?.type === 'entity' && s.record.kind === 'people' && !s.record.tags?.includes('enclave'));
    expect(peoples).toHaveLength(9);
    expect(peoples.every(s => s.record && 'body' in s.record && Boolean(s.record.body))).toBe(true);
    for (const name of ['blightmourn', 'irridosai', 'syntherion', 'umbrasa']) {
      expect(peoples.find(s => s.id === EXISTING['people/' + name])).toBeDefined();
    }
    const human = state.records[recordId(PROJECT, 'people/humans')]?.record;
    expect(human?.type === 'entity' && human.body).toContain('survived the Undertow');
    const umbra = state.records[EXISTING['people/umbrasa']!]!.record;
    expect(umbra?.type === 'entity' && umbra.body).toContain('## Origins and Early Evolution');
    expect(umbra?.type === 'entity' && umbra.body).toContain('Muunbrak and Hollmaw');
    expect(state.records[recordId(PROJECT, 'world-mechanic/post-tide-present')]?.record?.visibility).toBe('gm_only');
  });

  it('keeps unresolved legacy institutions private and keeps the complete bootstrap fixture', async () => {
    const { store } = await applyNext();
    const state = await store.getActiveState();
    for (const name of ['faction/mass-weavers', 'institution/gravitar']) {
      expect(state.records[recordId(PROJECT, name)]?.record).toMatchObject({ visibility:'gm_only', canonStatus:'unverified' });
    }
    expect(next.releaseId).toBe(current.releaseId);
    expect(current.operations.some(o => 'record' in o && o.record?.type === 'entity' && o.record.title === 'Humans')).toBe(true);
  });

  it('preserves GM notes through publication', async () => {
    const { publication, store, operations } = await setup();
    await operations.addGmNote({ subjectId: EXISTING['people/blightmourn'], body:'A proposed local story, not canon.' }, GM);
    await publication.publish(clone(next), GM);
    expect((await store.listGmNotes(EXISTING['people/blightmourn'])).map(n=>n.body)).toContain('A proposed local story, not canon.');
  });
});
