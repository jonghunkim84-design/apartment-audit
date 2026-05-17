export default async function PublicPortalPage({ params }: { params: Promise<{ complexCode: string }> }) {
  const { complexCode } = await params
  return <div>portal: {complexCode}</div>
}
