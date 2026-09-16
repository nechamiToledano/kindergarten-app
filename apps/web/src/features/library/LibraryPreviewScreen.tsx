import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { SubdomainForPlay } from '@kga/contracts';
import { Button, Card, ErrorState, Spinner } from '@kga/ui';
import { getSubdomainForPlay } from '../../shared/api/endpoints';
import { GamePlayer, type SubdomainRunResult } from '../sessions/GamePlayer';

type Stage =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'playing'; subdomain: SubdomainForPlay }
  | { kind: 'done'; result: SubdomainRunResult; subdomain: SubdomainForPlay };

/**
 * Preview only — routed chrome-free like /practice and /run, but nothing here
 * is ever saved: there is no session, and onComplete just flips to a "done"
 * card instead of queuing a result. This is what a teacher (or the content
 * editor, via a deep link from the admin app) opens from the catalogue to see
 * what a game actually does before assigning or publishing it.
 */
export function LibraryPreviewScreen() {
  const { subdomainId } = useParams<{ subdomainId: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });

  useEffect(() => {
    if (!subdomainId) return;
    let alive = true;
    setStage({ kind: 'loading' });
    getSubdomainForPlay(subdomainId)
      .then((subdomain) => alive && setStage({ kind: 'playing', subdomain }))
      .catch(
        (err) =>
          alive &&
          setStage({
            kind: 'error',
            message: err instanceof Error ? err.message : 'המשחק לא נטען',
          }),
      );
    return () => {
      alive = false;
    };
  }, [subdomainId]);

  if (stage.kind === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6" />
      </main>
    );
  }

  if (stage.kind === 'error') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-6">
        <ErrorState message={stage.message} />
        <Button variant="ghost" onClick={() => navigate('/library')}>
          חזרה לספרייה
        </Button>
      </main>
    );
  }

  if (stage.kind === 'playing') {
    return (
      <GamePlayer
        key={stage.subdomain.id}
        subdomain={{
          id: stage.subdomain.id,
          name: stage.subdomain.name,
          teacherInstruction: stage.subdomain.teacherInstruction,
          childInstruction: stage.subdomain.childInstruction,
          gameConfig: stage.subdomain.gameConfig,
        }}
        onComplete={(result) => setStage({ kind: 'done', result, subdomain: stage.subdomain })}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <Card className="flex flex-col items-center gap-3 p-6">
        <h1 className="font-display text-xl font-semibold">{stage.subdomain.name}</h1>
        <p className="text-sm text-muted-foreground">
          זו הייתה תצוגה מקדימה בלבד — שום תוצאה לא נשמרה.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button onClick={() => setStage({ kind: 'playing', subdomain: stage.subdomain })}>
            לשחק שוב
          </Button>
          <Button variant="ghost" onClick={() => navigate('/library')}>
            חזרה לספרייה
          </Button>
        </div>
      </Card>
    </main>
  );
}
