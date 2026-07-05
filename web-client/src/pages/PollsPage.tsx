import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Plus, Vote } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { nowAsDatetimeLocalValue } from '../lib/datetime.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { useToast } from '../context/ToastContext.js';
import { useT } from '../i18n/I18nContext.js';
import { PageHeader } from '../components/PageHeader.js';
import { EmptyState } from '../components/EmptyState.js';
import { Modal } from '../components/Modal.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';
import { Badge } from '@/components/ui/badge.js';
import { ListSkeleton } from '@/components/ui/skeleton.js';

type Poll = {
  _id: string;
  title: string;
  options: string[];
  status: string;
  pluginId?: string;
  closesAt?: string | null;
};

type PollDetail = {
  poll: Poll;
  tallies: Record<string, number>;
  totalVotes: number;
  percentages: number[];
  myChoice: number | null;
};

type PollPlugin = { id: string; name: string; description: string };

export function PollsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const t = useT();
  const { showToast } = useToast();

  const [polls, setPolls] = useState<Poll[]>([]);
  const [details, setDetails] = useState<Record<string, PollDetail>>({});
  const [plugins, setPlugins] = useState<PollPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Champs de la modale de création
  const [title, setTitle] = useState('');
  const [optionA, setOptionA] = useState('Oui');
  const [optionB, setOptionB] = useState('Non');
  const [optionC, setOptionC] = useState('Abstention');
  const [pluginId, setPluginId] = useState('standard');
  const [closesAt, setClosesAt] = useState('');
  const minDate = nowAsDatetimeLocalValue();

  useEffect(() => {
    void apiFetch<{ polls: PollPlugin[] }>('/plugins')
      .then((response) => setPlugins(response.polls))
      .catch(() => undefined);
  }, []);

  const loadDetail = useCallback(async (pollId: string) => {
    const detail = await apiFetch<PollDetail>(`/polls/${pollId}`);
    setDetails((previous) => ({ ...previous, [pollId]: detail }));
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) {
      setPolls([]);
      setLoading(false);
      return;
    }
    try {
      const response = await apiFetch<{ items: Poll[] }>(`/polls?neighbourhoodId=${selectedId}`);
      setPolls(response.items);
      await Promise.all(response.items.map((poll) => loadDetail(poll._id)));
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  }, [selectedId, t, loadDetail]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(formEvent: FormEvent): Promise<void> {
    formEvent.preventDefault();
    if (!selectedId) return;
    setErrorMessage(null);
    const options =
      pluginId === 'min-three-options'
        ? [optionA, optionB, optionC]
        : [optionA, optionB].filter(Boolean);
    try {
      await apiFetch('/polls', {
        method: 'POST',
        json: { neighbourhoodId: selectedId, title, options, pluginId, closesAt },
      });
      setTitle('');
      setClosesAt('');
      setCreating(false);
      showToast(t('polls.created'));
      await load();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  async function vote(pollId: string, choiceIndex: number): Promise<void> {
    setErrorMessage(null);
    try {
      await apiFetch(`/polls/${pollId}/vote`, { method: 'POST', json: { choiceIndex } });
      await loadDetail(pollId);
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  return (
    <div>
      <PageHeader
        title={t('polls.title')}
        description={t('polls.subtitle')}
        action={
          selectedId ? (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('polls.new')}
            </Button>
          ) : undefined
        }
      />

      {!selectedId ? (
        <p className="text-muted-foreground">{t('common.selectNeighbourhood')}</p>
      ) : (
        <div className="space-y-4">
          {errorMessage && !creating ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <ListSkeleton />
          ) : polls.length === 0 ? (
            <EmptyState icon={Vote} text={t('polls.empty')} />
          ) : (
            <ul className="space-y-3">
              {polls.map((poll) => (
                <PollCard
                  key={poll._id}
                  poll={poll}
                  detail={details[poll._id]}
                  onVote={(choiceIndex) => void vote(poll._id, choiceIndex)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {creating ? (
        <Modal title={t('polls.new')} onClose={() => setCreating(false)}>
          <form className="space-y-3" onSubmit={(formEvent) => void create(formEvent)}>
            <div className="space-y-1.5">
              <Label htmlFor="poll-question">{t('polls.form.question')}</Label>
              <Input
                id="poll-question"
                value={title}
                onChange={(changeEvent) => setTitle(changeEvent.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('polls.form.type')}</Label>
              <Select value={pluginId} onValueChange={setPluginId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plugins.map((plugin) => (
                    <SelectItem key={plugin.id} value={plugin.id}>
                      {plugin.name}
                    </SelectItem>
                  ))}
                  {!plugins.length ? <SelectItem value="standard">standard</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="poll-option-a">{t('polls.form.optionA')}</Label>
                <Input
                  id="poll-option-a"
                  className="w-40"
                  value={optionA}
                  onChange={(changeEvent) => setOptionA(changeEvent.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poll-option-b">{t('polls.form.optionB')}</Label>
                <Input
                  id="poll-option-b"
                  className="w-40"
                  value={optionB}
                  onChange={(changeEvent) => setOptionB(changeEvent.target.value)}
                />
              </div>
              {pluginId === 'min-three-options' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="poll-option-c">{t('polls.form.optionC')}</Label>
                  <Input
                    id="poll-option-c"
                    className="w-40"
                    value={optionC}
                    onChange={(changeEvent) => setOptionC(changeEvent.target.value)}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="poll-closes-at">{t('polls.form.closesAt')}</Label>
              <Input
                id="poll-closes-at"
                type="datetime-local"
                className="w-56"
                min={minDate}
                value={closesAt}
                onChange={(changeEvent) => setClosesAt(changeEvent.target.value)}
                required
              />
            </div>
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('polls.form.create')}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function PollCard({
  poll,
  detail,
  onVote,
}: {
  poll: Poll;
  detail: PollDetail | undefined;
  onVote: (choiceIndex: number) => void;
}): ReactElement {
  const t = useT();
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
        {poll.options.map((option, optionIndex) => {
          const percentage = percentages[optionIndex] ?? 0;
          const isMyChoice = myChoice === optionIndex;
          return (
            <button
              key={option}
              type="button"
              disabled={!isOpen}
              onClick={() => onVote(optionIndex)}
              className={
                'relative block w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors ' +
                (isMyChoice
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'border-border hover:border-primary/40') +
                (isOpen ? ' cursor-pointer' : ' cursor-default')
              }
            >
              <span
                className={'absolute inset-y-0 left-0 ' + (isMyChoice ? 'bg-primary/25' : 'bg-muted')}
                style={{ width: `${percentage}%` }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between gap-2">
                <span>
                  {isMyChoice ? '✓ ' : ''}
                  {option}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {percentage}% ({tallies[optionIndex] ?? 0})
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
