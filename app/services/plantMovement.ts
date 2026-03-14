import type { Area, PlanterSquare } from "../types";

export interface PlantMoveLocation {
  areaId: string;
  planterId: string;
  row: number;
  col: number;
}

function buildEmptySquares(rows: number, cols: number): PlanterSquare[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ plantInstance: null })),
  );
}

function cloneSquares(
  squares: PlanterSquare[][] | undefined,
  rows: number,
  cols: number,
): PlanterSquare[][] {
  const source =
    squares && squares.length === rows && squares[0]?.length === cols
      ? squares
      : buildEmptySquares(rows, cols);

  return source.map((row) => row.map((square) => ({ ...square })));
}

function getSquare(
  areas: Area[],
  location: PlantMoveLocation,
): PlanterSquare | null {
  const area = areas.find((candidate) => candidate.id === location.areaId);
  const planter = area?.planters.find(
    (candidate) => candidate.id === location.planterId,
  );

  return planter?.squares?.[location.row]?.[location.col] ?? null;
}

export function movePlantBetweenLocations(
  areas: Area[],
  source: PlantMoveLocation,
  target: PlantMoveLocation,
): Area[] {
  if (
    source.areaId === target.areaId &&
    source.planterId === target.planterId &&
    source.row === target.row &&
    source.col === target.col
  ) {
    return areas;
  }

  const sourceSquare = getSquare(areas, source);
  const targetSquare = getSquare(areas, target);
  const sourceInstance = sourceSquare?.plantInstance ?? null;

  if (!sourceInstance) {
    return areas;
  }

  const targetInstance = targetSquare?.plantInstance ?? null;

  return areas.map((area) => {
    if (area.id !== source.areaId && area.id !== target.areaId) {
      return area;
    }

    let areaChanged = false;
    const nextPlanters = area.planters.map((planter) => {
      const isSourcePlanter =
        area.id === source.areaId && planter.id === source.planterId;
      const isTargetPlanter =
        area.id === target.areaId && planter.id === target.planterId;

      if (!isSourcePlanter && !isTargetPlanter) {
        return planter;
      }

      const nextSquares = cloneSquares(planter.squares, planter.rows, planter.cols);

      if (isSourcePlanter) {
        nextSquares[source.row][source.col] = {
          ...nextSquares[source.row][source.col],
          plantInstance: targetInstance,
        };
      }

      if (isTargetPlanter) {
        nextSquares[target.row][target.col] = {
          ...nextSquares[target.row][target.col],
          plantInstance: sourceInstance,
        };
      }

      areaChanged = true;
      return {
        ...planter,
        squares: nextSquares,
      };
    });

    return areaChanged
      ? {
          ...area,
          planters: nextPlanters,
        }
      : area;
  });
}