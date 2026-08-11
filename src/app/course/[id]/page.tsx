import { Workspace } from "@/components/workspace/workspace";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Workspace courseId={id} />;
}
