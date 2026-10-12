export interface TableSection {
  id: string;
  name: string;
  tables: string[];
}

export const DEFAULT_TABLE_SECTIONS: TableSection[] = [
  {
    id: 'salon',
    name: 'Salón',
    tables: ['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6', 'Mesa 7', 'Mesa 8'],
  },
  {
    id: 'barra',
    name: 'Barra',
    tables: ['Barra 1', 'Barra 2', 'Barra 3', 'Barra 4'],
  },
  {
    id: 'terraza',
    name: 'Terraza',
    tables: ['Terraza 1', 'Terraza 2', 'Terraza 3', 'Terraza 4'],
  },
];
