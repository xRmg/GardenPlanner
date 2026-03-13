import type { Area, Plant } from "../data/schema";

export interface PlacedPlant {
  instanceId: string;
  plant: Plant;
  plantingDate?: string;
  harvestDate?: string;
  pestEvents: Array<{
    id: string;
    date: string;
    type: "pest" | "treatment";
    description: string;
  }>;
  planterId: string;
  planterName: string;
  areaId: string;
  areaName: string;
  adjacentPlantNames: string[];
}

function buildAdjacentPlantNames(
  squares:
    | Array<
        Array<{
          plantInstance: { instanceId: string; plant: { name: string } } | null;
        }>
      >
    | undefined,
  rows: number,
  cols: number,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!squares) return result;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let colIndex = 0; colIndex < cols; colIndex += 1) {
      const cell = squares[rowIndex]?.[colIndex]?.plantInstance;
      if (!cell) continue;

      const adjacentPlantNames: string[] = [];
      const deltas = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];

      for (const [deltaRow, deltaCol] of deltas) {
        const nextRow = rowIndex + deltaRow;
        const nextCol = colIndex + deltaCol;
        if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) {
          continue;
        }

        const neighbor = squares[nextRow]?.[nextCol]?.plantInstance;
        if (neighbor && neighbor.instanceId !== cell.instanceId) {
          adjacentPlantNames.push(neighbor.plant.name);
        }
      }

      result.set(cell.instanceId, adjacentPlantNames);
    }
  }

  return result;
}

export function buildPlacedPlants(areas: Area[]): PlacedPlant[] {
  const placedPlants: PlacedPlant[] = [];

  for (const area of areas) {
    for (const planter of area.planters) {
      const adjacentMap = buildAdjacentPlantNames(
        planter.squares,
        planter.rows,
        planter.cols,
      );

      for (const row of planter.squares ?? []) {
        for (const cell of row) {
          if (!cell.plantInstance) continue;

          const { instanceId, plant, plantingDate, harvestDate } =
            cell.plantInstance;

          placedPlants.push({
            instanceId,
            plant,
            plantingDate,
            harvestDate,
            pestEvents: cell.plantInstance.pestEvents ?? [],
            planterId: planter.id,
            planterName: planter.name,
            areaId: area.id,
            areaName: area.name,
            adjacentPlantNames: adjacentMap.get(instanceId) ?? [],
          });
        }
      }
    }
  }

  return placedPlants;
}