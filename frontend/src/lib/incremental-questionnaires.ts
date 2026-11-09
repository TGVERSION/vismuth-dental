/** Preserve order while a neighbouring page repeats an item after data changes. */
export function appendUniqueItems<T extends { id: string }>(
  previous: T[],
  incoming: T[],
): T[] {
  const positions = new Map(previous.map((item, index) => [item.id, index]));
  const result = [...previous];
  for (const item of incoming) {
    const index = positions.get(item.id);
    if (index === undefined) {
      positions.set(item.id, result.length);
      result.push(item);
    } else result[index] = item;
  }
  return result;
}
