export const mapId = <T extends { _id?: string }>(obj: T) => {
  const { _id, ...rest } = obj;
  return { id: _id, ...rest } as Omit<T, '_id'> & { id: string | undefined };
};

export const mapArrayIds = <T extends { _id?: string }>(arr: T[]) => {
  return arr.map(mapId);
};
