import type { GlobalPoint } from "../../math";
import {
  arc,
  arcDistanceFromPoint,
  ellipse,
  ellipseDistanceFromPoint,
  pointFrom,
  pointRotateRads,
  radians,
  rectangle,
  segment,
  segmentDistanceToPoint,
} from "../../math";
import { getCornerRadius, getDiamondPoints } from "../shapes";
import { createDiamondArc, createDiamondSide } from "./bounds";
import type {
  ExcalidrawBindableElement,
  ExcalidrawDiamondElement,
  ExcalidrawEllipseElement,
  ExcalidrawRectanguloidElement,
} from "./types";

export const distanceToBindableElement = (
  element: ExcalidrawBindableElement,
  p: GlobalPoint,
): number => {
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return distanceToRectangleElement(element, p);
    case "diamond":
      return distanceToDiamondElement(element, p);
    case "ellipse":
      return distanceToEllipseElement(element, p);
  }
};

/**
 * Returns the distance of a point and the provided rectangular-shaped element,
 * accounting for roundness and rotation
 *
 * @param element The rectanguloid element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the rectanguloid element
 */
export const distanceToRectangleElement = (
  element: ExcalidrawRectanguloidElement,
  p: GlobalPoint,
) => {
  const r = rectangle(
    pointFrom(element.x, element.y),
    pointFrom(element.x + element.width, element.y + element.height),
  );
  // To emulate a rotated rectangle we rotate the point in the inverse angle
  // instead. It's all the same distance-wise.
  const rotatedPoint = pointRotateRads(
    p,
    pointFrom(element.x + element.width / 2, element.y + element.height / 2),
    radians(-element.angle),
  );
  const roundness = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );
  const sideDistances = [
    segment(
      pointFrom(r[0][0] + roundness, r[0][1]),
      pointFrom(r[1][0] - roundness, r[0][1]),
    ),
    segment(
      pointFrom(r[1][0], r[0][1] + roundness),
      pointFrom(r[1][0], r[1][1] - roundness),
    ),
    segment(
      pointFrom(r[1][0] - roundness, r[1][1]),
      pointFrom(r[0][0] + roundness, r[1][1]),
    ),
    segment(
      pointFrom(r[0][0], r[1][1] - roundness),
      pointFrom(r[0][0], r[0][1] + roundness),
    ),
  ].map((s) => segmentDistanceToPoint(rotatedPoint, s));
  const cornerDistances =
    roundness > 0
      ? [
          arc(
            pointFrom(r[0][0] + roundness, r[0][1] + roundness),
            roundness,
            radians(Math.PI),
            radians((3 / 4) * Math.PI),
          ),
          arc(
            pointFrom(r[1][0] - roundness, r[0][1] + roundness),
            roundness,
            radians((3 / 4) * Math.PI),
            radians(0),
          ),
          arc(
            pointFrom(r[1][0] - roundness, r[1][1] - roundness),
            roundness,
            radians(0),
            radians((1 / 2) * Math.PI),
          ),
          arc(
            pointFrom(r[0][0] + roundness, r[1][1] - roundness),
            roundness,
            radians((1 / 2) * Math.PI),
            radians(Math.PI),
          ),
        ].map((a) => arcDistanceFromPoint(a, rotatedPoint))
      : [];

  return Math.min(...[...sideDistances, ...cornerDistances]);
};

/**
 * Returns the distance of a point and the provided diamond element, accounting
 * for roundness and rotation
 *
 * @param element The diamond element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the diamond
 */
export const distanceToDiamondElement = (
  element: ExcalidrawDiamondElement,
  p: GlobalPoint,
): number => {
  const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
    getDiamondPoints(element);
  const center = pointFrom<GlobalPoint>(
    (topX + bottomX) / 2,
    (topY + bottomY) / 2,
  );
  const verticalRadius = getCornerRadius(Math.abs(topX - leftX), element);
  const horizontalRadius = getCornerRadius(Math.abs(rightY - topY), element);

  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedPoint = pointRotateRads(p, center, radians(-element.angle));
  const [top, right, bottom, left]: GlobalPoint[] = [
    pointFrom(element.x + topX, element.y + topY),
    pointFrom(element.x + rightX, element.y + rightY),
    pointFrom(element.x + bottomX, element.y + bottomY),
    pointFrom(element.x + leftX, element.y + leftY),
  ];

  const topRight = createDiamondSide(
    segment(top, right),
    verticalRadius,
    horizontalRadius,
  );
  const bottomRight = createDiamondSide(
    segment(bottom, right),
    verticalRadius,
    horizontalRadius,
  );
  const bottomLeft = createDiamondSide(
    segment(bottom, left),
    verticalRadius,
    horizontalRadius,
  );
  const topLeft = createDiamondSide(
    segment(top, left),
    verticalRadius,
    horizontalRadius,
  );

  const arcs = element.roundness
    ? [
        createDiamondArc(topLeft[0], topRight[0], verticalRadius), // TOP
        createDiamondArc(topRight[1], bottomRight[1], horizontalRadius), // RIGHT
        createDiamondArc(bottomRight[0], bottomLeft[0], verticalRadius), // BOTTOM
        createDiamondArc(bottomLeft[1], topLeft[1], horizontalRadius), // LEFT
      ]
    : [];

  return Math.min(
    ...[
      ...[topRight, bottomRight, bottomLeft, topLeft].map((s) =>
        segmentDistanceToPoint(rotatedPoint, s),
      ),
      ...arcs.map((a) => arcDistanceFromPoint(a, rotatedPoint)),
    ],
  );
};

/**
 * Returns the distance of a point and the provided ellipse element, accounting
 * for roundness and rotation
 *
 * @param element The ellipse element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the ellipse
 */
export const distanceToEllipseElement = (
  element: ExcalidrawEllipseElement,
  p: GlobalPoint,
): number => {
  const center = pointFrom(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  return ellipseDistanceFromPoint(
    // Instead of rotating the ellipse, rotate the point to the inverse angle
    pointRotateRads(p, center, radians(-element.angle)),
    ellipse(center, element.width / 2, element.height / 2),
  );
};
