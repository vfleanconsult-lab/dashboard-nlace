export default function RankBadge({ n }: { n: number }) {
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-mono border font-medium ${n < 3 ? 'bg-nl-primary-10 border-nl-primary-20 text-nl-primary' : 'bg-nl-bg border-nl-border-ui text-nl-400'}`}>
      {n + 1}
    </span>
  )
}
