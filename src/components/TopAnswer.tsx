/** The best answer so far on a fire card: a small label, the answer's name and the start of its description. Used on the board and in the Library. */
export default function TopAnswer({ name, snippet, lines = 2 }: { name: string; snippet?: string; lines?: 1 | 2 }) {
  return (
    <div className="top-answer">
      <p className="top-answer-label">Top answer</p>
      <p className="my-answer-name">{name}</p>
      {snippet && <p className={`top-answer-snippet lines-${lines}`}>{snippet}</p>}
    </div>
  );
}
