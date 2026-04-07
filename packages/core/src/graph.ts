import type { Annotation, Connection, ConnectionType, Step, Tour } from '@tourguide/format';

export type TourNode = Step | Annotation;
export type RelatedNode = { node: TourNode; connection: Connection };

export type TourGraph = {
  outgoing: (id: string) => Connection[];
  incoming: (id: string) => Connection[];
  related: (id: string) => RelatedNode[];
  byType: (id: string, type: ConnectionType) => TourNode[];
};

export function resolveNode(tour: Tour, id: string): TourNode | undefined {
  for (const chapter of tour.chapters) {
    const step = chapter.steps.find((candidate) => candidate.id === id);
    if (step) {
      return step;
    }
  }
  return tour.annotations.find((annotation) => annotation.id === id);
}

function connectionKey(connection: Connection): string {
  return `${connection.from}|${connection.to}|${connection.type}`;
}

function collectConnections(tour: Tour): Connection[] {
  const byKey = new Map<string, Connection>();

  for (const connection of tour.connections) {
    byKey.set(connectionKey(connection), connection);
  }

  for (const chapter of tour.chapters) {
    for (const step of chapter.steps) {
      for (const connection of step.connections) {
        const key = connectionKey(connection);
        if (!byKey.has(key)) {
          byKey.set(key, connection);
        }
      }
    }
  }

  return Array.from(byKey.values());
}

export function buildGraph(tour: Tour): TourGraph {
  const outgoingByNode = new Map<string, Connection[]>();
  const incomingByNode = new Map<string, Connection[]>();

  for (const connection of collectConnections(tour)) {
    const outgoing = outgoingByNode.get(connection.from) ?? [];
    outgoing.push(connection);
    outgoingByNode.set(connection.from, outgoing);

    const incoming = incomingByNode.get(connection.to) ?? [];
    incoming.push(connection);
    incomingByNode.set(connection.to, incoming);
  }

  return {
    outgoing(id: string) {
      return outgoingByNode.get(id) ?? [];
    },
    incoming(id: string) {
      return incomingByNode.get(id) ?? [];
    },
    related(id: string) {
      return (outgoingByNode.get(id) ?? [])
        .map((connection) => ({
          connection,
          node: resolveNode(tour, connection.to),
        }))
        .filter((item): item is RelatedNode => item.node !== undefined);
    },
    byType(id: string, type: ConnectionType) {
      return this.related(id)
        .filter((item) => item.connection.type === type)
        .map((item) => item.node);
    },
  };
}
