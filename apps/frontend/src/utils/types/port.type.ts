export type Port = {
  _id: string;
  name: string;
  code: string;
  country: string;
  modes: ("maritime" | "air" | "road")[];
  isActive?: boolean;
};
