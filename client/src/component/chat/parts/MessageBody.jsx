const TOKEN_RE = /(https?:\/\/[^\s<]+|@[\p{L}\p{N}_-]+)/gu;
const URL_RE = /^https?:\/\//;
const TRAILING_RE = /[.,;:!?)\]]+$/;

export default function MessageBody({ body = "", currentUsername = "" }) {
  const me = currentUsername.toLowerCase();
  const parts = body.split(TOKEN_RE);

  return (
    <p className="mt-0.5 whitespace-pre-line text-ink-2 [overflow-wrap:anywhere]">
      {parts.map((part, index) => {
        if (!part) return null;

        if (URL_RE.test(part)) {
          const trailing = part.match(TRAILING_RE)?.[0] ?? "";
          const url = trailing ? part.slice(0, -trailing.length) : part;
          return (
            <span key={index}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                {url}
              </a>
              {trailing}
            </span>
          );
        }

        if (part.startsWith("@")) {
          const isMe = me && part.slice(1).toLowerCase() === me;
          return (
            <span
              key={index}
              className={`rounded-card px-1 font-medium ${
                isMe ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent"
              }`}
            >
              {part}
            </span>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}
