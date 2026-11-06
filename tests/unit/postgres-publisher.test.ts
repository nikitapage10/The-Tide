import { describe, it, expect, vi } from 'vitest';
const { spawn } = vi.hoisted(() => ({spawn:vi.fn()}));
vi.mock('node:child_process',()=>({spawnSync:spawn}));
import { PostgresPublicationStore } from '../../scripts/postgres-publication-store';
describe('Postgres publication transport',()=>{
 it('treats an empty psql scalar as SQL null and keeps credentials out of arguments', async()=>{
  spawn.mockReturnValue({status:0,stdout:'\n',stderr:''});
  const store=new PostgresPublicationStore('postgresql://postgres:test-password@localhost/postgres?host=/tmp/tide-test&port=54329','333ea628-f6a1-4f3a-8b83-ce98d12f2565');
  expect(await store.getRelease('00000000-0000-4000-8000-000000000000')).toBeNull();
  const [command,args,options]=spawn.mock.calls.at(-1)!;
  expect(command).toBe('psql');expect(args.join(' ')).not.toContain('test-password');expect(options.input).not.toContain('test-password');
  expect(options.env.PGHOST).toBe('/tmp/tide-test');expect(options.env.PGPORT).toBe('54329');
 });
});
