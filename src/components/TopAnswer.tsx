/** The best answer so far on a fire card: a small label and the answer's name. Used on the board and in the Library. */
export default function TopAnswer({ name }: { name: string }) {
  return (
    <div className="top-answer">
      <p className="top-answer-label">Top answer</p>
      <p className="my-answer-name">{name}</p>
    </div>
  );
}
