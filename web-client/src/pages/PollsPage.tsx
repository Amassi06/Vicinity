import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { useT } from '../i18n/I18nContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';
import { Badge } from '@/components/ui/badge.js';

type PollDoc = {
  _id: string;
  title: string;
  options: string[];
  status: string;
  pluginId?: string;
  closesAt?: string | null;
};

type PollDetail = {
  poll: PollDoc;
  tallies: Record<string, number>;
  totalVotes: number;
  percentages: number[];
  myChoice: number | null;
};

type PluginInfo = { id: string; name: string; description: string };

function nowLocalValue(): string {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return now.toISOString().slice(0, 16);
}

export function PollsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const t = useT();
  const [items, setItems] = useState<PollDoc[]>([]);
  const [details, setDetails] = useState<Record<string, PollDetail>>({});
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [title, setTitle] = useState('');
  const [optA, setOptA] = useState('Oui');
  const [optB, setOptB] = useState('Non');
  const [optC, setOptC] = useState('Abstention');
  const [pluginId, setPluginId] = useState('standard');
  const [closesAt, setClosesAt] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const minDate = nowLocalValue();

  useEffect(() => {
    void apiFetch<{ polls: PluginInfo[] }>('/plugins')
      .then((r) => setPlugins(r.polls))
      .catch(() => undefined);
  }, []);

  const loadDetail = useCallback(async (pollId: string) => {
    const d = await apiFetch<PollDetail>(`/polls/${pollId}`);
    setDetails((prev) => ({ ...prev, [pollId]: d }));
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) {
      setItems([]);
      return;
    }
    try {
      const res = await apiFetch<{ items: PollDoc[] }>(`/polls?neighbourhoodId=${selectedId}`);
      setItems(res.items);
      await Promise.all(res.items.map((p) => loadDetail(p._id)));
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }, [selectedId, t, loadDetail]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!selectedId) return;
    setErr(null);
    const options =
      pluginId === 'min-three-options' ? [optA, optB, optC] : [optA, optB].filter(Boolean);
    try {
      await apiFetch('/polls', {
        method: 'POST',
        json: { neighbourhoodId: selectedId, title, options, pluginId, closesAt },
      });
      setTitle('');
      setClosesAt('');
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }

  async function vote(pollId: string, choiceIndex: number): Promise<void> {
    setErr(null);
    try {
      await apiFetch(`/polls/${pollId}/vote`, { method: 'POST', json: { choiceIndex } });
      await loadDetail(pollId);
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('polls.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedId ? (
          <p className="text-muted-foreground">{t('common.selectNeighbourhood')}</p>
        ) : (
          <>
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void create(e)}>
              <Input
                className="max-w-56"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('polls.form.question')}
                required
              />
              <Select value={pluginId} onValueChange={setPluginId}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plugins.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  {!plugins.length ? <SelectItem value="standard">standard</SelectItem> : null}
                </SelectContent>
              </Select>
              <Input
                className="max-w-32"
                value={optA}
                onChange={(e) => setOptA(e.target.value)}
                placeholder={t('polls.form.optionA')}
              />
              <Input
                className="max-w-32"
                value={optB}
                onChange={(e) => setOptB(e.target.value)}
                placeholder={t('polls.form.optionB')}
              />
              {pluginId === 'min-three-options' ? (
                <Input
                  className="max-w-32"
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                  placeholder={t('polls.form.optionC')}
                />
              ) : null}
              <Input
                type="datetime-local"
                className="max-w-52"
                min={minDate}
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                required
                aria-label={t('polls.form.closesAt')}
              />
              <Button type="submit">{t('polls.form.create')}</Button>
            </form>
            {err ? (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ) : null}
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-input p-8 text-center text-muted-foreground">
                {t('polls.empty')}
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((p) => (
                  <PollCard
                    key={p._id}
                    poll={p}
                    detail={details[p._id]}
                    t={t}
                    onVote={(i) => void vote(p._id, i)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PollCard({
  poll,
  detail,
  t,
  onVote,
}: {
  poll: PollDoc;
  detail: PollDetail | undefined;
  t: (key: string) => string;
  onVote: (choiceIndex: number) => void;
}): ReactElement {
  const percentages = detail?.percentages ?? poll.options.map(() => 0);
  const tallies = detail?.tallies ?? {};
  const myChoice = detail?.myChoice ?? null;
  const isOpen = poll.status === 'open';

  return (
    <li className="rounded-lg border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">{poll.title}</strong>
        <Badge variant="secondary">{poll.pluginId ?? 'standard'}</Badge>
        <Badge variant={isOpen ? 'success' : 'secondary'}>
          {isOpen ? t('polls.open') : t('polls.closed')}
        </Badge>
        {poll.closesAt ? (
          <span className="text-xs text-muted-foreground">
            {isOpen ? t('polls.closesAt') : t('polls.closedAt')}{' '}
            {new Date(poll.closesAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {poll.options.map((option, i) => {
          const pct = percentages[i] ?? 0;
          const mine = myChoice === i;
          return (
            <button
              key={option}
              type="button"
              disabled={!isOpen}
              onClick={() => onVote(i)}
              className={
                'relative block w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors ' +
                (mine ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-primary/40') +
                (isOpen ? ' cursor-pointer' : ' cursor-default')
              }
            >
              <span
                className={'absolute inset-y-0 left-0 ' + (mine ? 'bg-primary/25' : 'bg-muted')}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between gap-2">
                <span>
                  {mine ? '✓ ' : ''}
                  {option}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {pct}% ({tallies[i] ?? 0})
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('polls.totalVotes')} {detail?.totalVotes ?? 0}
        {isOpen ? ` · ${t('polls.canChange')}` : ''}
      </p>
    </li>
  );
}
