
const VERTICES = Symbol();
const EDGES = Symbol();

export class DependencyGraph {
    constructor({vertices=[], edges=[]}={}) {
        this[VERTICES] = new Set();
        this[EDGES] = new Map();

        vertices.forEach(address => this.addVertex(address));
        edges.forEach(([tail, head]) => this.addEdge(tail, head));
    }

    get vertices() {
        return [...this[VERTICES]];
    }

    get edges() {
        return [...this[EDGES]].map(([tail, heads]) => [tail, [...heads]]);
    }

    addEdge(tail, head) {
        if (tail == head) {
            throw new Error(`Can't add edge from "${tail}" to itself.`);
        }
        if (!this[EDGES].has(tail)) {
            throw new Error(`Can't add edge from '${tail}' to '${head}' because vertex '${tail}' does not exist.`);
        }
        const edge = this[EDGES].get(tail);
        edge.add(head);
    }

    addVertex(address) {
        this[VERTICES].add(address);
        if (!this[EDGES].has(address)) {
            this[EDGES].set(address, new Set());
        }
    }

    removeVertex(address) {
        if (this[EDGES].has(address)) {
            this[VERTICES].delete(address);
            this[EDGES].delete(address);
        }
    }

    toString() {
        return JSON.stringify(Array.from(this[EDGES].entries())
            .reduce((acc, [k,v]) => 
                Object.assign(acc, { [k]: Array.from(v) })
            , {}))
    }
}

class Vertex {
    constructor(address) {
        this.address = address;
    }
}

class Edge {
    constructor(tail, head) {
        this.tail = tail;
        this.head = head;
    }
}