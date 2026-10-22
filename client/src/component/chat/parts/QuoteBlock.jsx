export default function QuoteBlock({ username, body }) {
  return (
    <blockquote className="mt-1 border-l-2 border-muted py-1 pl-3 text-[13px] text-muted">
      <b className="block text-xs font-semibold text-ink">{username}</b>
      <span className="[overflow-wrap:anywhere]">{body}</span>
    </blockquote>
  );
}
