import Icon from "./icons.jsx";

export default function PinnedBar({ pinned, onView }) {
  if (!pinned) return null;

  return (
    <div className="mx-4 mt-3 flex flex-none items-center gap-3 rounded-card border border-line bg-surface py-2 pl-3 pr-2 text-[13px] md:mx-6">
      <Icon name="pin" className="h-4 w-4 text-muted" />
      <div className="min-w-0 flex-1 truncate">
        <b className="font-semibold">{pinned.username}</b>{" "}
        <span className="text-muted">· {pinned.body}</span>
      </div>
      <button
        type="button"
        onClick={() => onView?.(pinned)}
        aria-label={`Ver mensaje fijado de ${pinned.username}`}
        className="min-h-10 min-w-10 flex-none rounded-card md:min-h-7 md:min-w-0 border border-line bg-bg px-3 text-[13px] font-medium hover:border-muted focus-visible:outline-2 focus-visible:outline-accent"
      >
        Ver
      </button>
    </div>
  );
}
