import { MessyNotesRunPage } from '@/components/messy-notes-run-page';

export const dynamic = 'force-dynamic';

type RunPageProps = {
  params: Promise<{
    runId: string;
  }>;
};

export default async function RunPage({ params }: Readonly<RunPageProps>) {
  const { runId } = await params;
  return <MessyNotesRunPage runId={Number.parseInt(runId, 10)} />;
}
