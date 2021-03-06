const assert = require('assert');
const Heap = require('qheap');

module.exports = {};
module.exports.syncAStar = aStar;
module.exports.asyncAStar = AsyncAStar;

function aStar(params) {
    assert.ok(params.start !== undefined);
    assert.ok(params.isEnd !== undefined);
    assert.ok(params.neighbor);
    assert.ok(params.distance);
    assert.ok(params.heuristic);
    if (params.timeout === undefined) params.timeout = Infinity;
    assert.ok(!isNaN(params.timeout));
    const hash = params.hash || defaultHash;

    let startNode = {
        data: params.start,
        g: 0,
        h: params.heuristic(params.start),
    };
    let bestNode = startNode;
    startNode.f = startNode.h;
    // leave .parent undefined
    const closedDataSet = new Set();
    const openHeap = new Heap({compar: heapComparator});
    const openDataMap = new Map();
    openHeap.push(startNode);
    openDataMap.set(hash(startNode.data), startNode);
    const startTime = new Date();
    while (openHeap.length) {
        if (new Date() - startTime > params.timeout) {
            return {
                status: 'timeout',
                cost: bestNode.g,
                path: reconstructPath(bestNode),
            };
        }
        let node = openHeap.remove();
        openDataMap.delete(hash(node.data));
        if (params.isEnd(node.data)) {
            // done
            return {
                status: 'success',
                cost: node.g,
                path: reconstructPath(node),
            };
        }
        // not done yet
        closedDataSet.add(hash(node.data));
        let neighbors = params.neighbor(node.data);
        for (let i = 0; i < neighbors.length; i++) {
            let neighborData = neighbors[i];
            if (closedDataSet.has(hash(neighborData))) {
                // skip closed neighbors
                continue;
            }
            let gFromThisNode = node.g + params.distance(node.data, neighborData);
            let neighborNode = openDataMap.get(hash(neighborData));
            let update = false;
            if (neighborNode === undefined) {
                // add neighbor to the open set
                neighborNode = {
                    data: neighborData,
                };
                // other properties will be set later
                openDataMap.set(hash(neighborData), neighborNode);
            } else {
                if (neighborNode.g < gFromThisNode) {
                    // skip this one because another route is faster
                    continue;
                }
                update = true;
            }
            // found a new or better route.
            // update this neighbor with this node as its new parent
            neighborNode.parent = node;
            neighborNode.g = gFromThisNode;
            neighborNode.h = params.heuristic(neighborData);
            neighborNode.f = gFromThisNode + neighborNode.h;
            if (neighborNode.h < bestNode.h) bestNode = neighborNode;
            if (!update) {
                openHeap.push(neighborNode);
            }
        }
    }
    // all the neighbors of every accessible node have been exhausted
    return {
        status: "noPath",
        cost: bestNode.g,
        path: reconstructPath(bestNode),
    };
}

function AsyncAStar(params) {
    assert.ok(params.start !== undefined);
    assert.ok(params.isEnd !== undefined);
    assert.ok(params.neighbor);
    assert.ok(params.distance);
    assert.ok(params.heuristic);
    if (params.timeout === undefined) params.timeout = Infinity;
    assert.ok(!isNaN(params.timeout));
    const hash = params.hash || defaultHash;

    let startNode = {
        data: params.start,
        g: 0,
        h: params.heuristic(params.start),
    };
    let bestNode = startNode;
    startNode.f = startNode.h;
    // leave .parent undefined
    const closedDataSet = new Set();
    const openHeap = new Heap({compar: heapComparator});
    const openDataMap = new Map();
    openHeap.push(startNode);
    openDataMap.set(hash(startNode.data), startNode);
    const startTime = new Date();

    return new Promise(resolve => {
        function pop() {
            if (openHeap.length === 0) {
                return resolve({
                    status: "noPath",
                    cost: bestNode.g,
                    path: reconstructPath(bestNode),
                });
            }

            if (new Date() - startTime > params.timeout) {
                return resolve({
                    status: 'timeout',
                    cost: bestNode.g,
                    path: reconstructPath(bestNode),
                });
            }
            let node = openHeap.remove();
            openDataMap.delete(hash(node.data));
            if (params.isEnd(node.data)) {
                // done
                return resolve({
                    status: 'success',
                    cost: node.g,
                    path: reconstructPath(node),
                });
            }
            // not done yet
            closedDataSet.add(hash(node.data));
            let neighbors = params.neighbor(node.data);
            for (let i = 0; i < neighbors.length; i++) {
                let neighborData = neighbors[i];
                if (closedDataSet.has(hash(neighborData))) {
                    // skip closed neighbors
                    continue;
                }
                let gFromThisNode = node.g + params.distance(node.data, neighborData);
                let neighborNode = openDataMap.get(hash(neighborData));
                let update = false;
                if (neighborNode === undefined) {
                    // add neighbor to the open set
                    neighborNode = {
                        data: neighborData,
                    };
                    // other properties will be set later
                    openDataMap.set(hash(neighborData), neighborNode);
                } else {
                    if (neighborNode.g < gFromThisNode) {
                        // skip this one because another route is faster
                        continue;
                    }
                    update = true;
                }
                // found a new or better route.
                // update this neighbor with this node as its new parent
                neighborNode.parent = node;
                neighborNode.g = gFromThisNode;
                neighborNode.h = params.heuristic(neighborData);
                neighborNode.f = gFromThisNode + neighborNode.h;
                if (neighborNode.h < bestNode.h) bestNode = neighborNode;
                if (!update) openHeap.push(neighborNode);
            }
            process.nextTick(pop);
        }
        process.nextTick(pop);
    });

}

function reconstructPath(node) {
    if (node.parent !== undefined) {
        let pathSoFar = reconstructPath(node.parent);
        pathSoFar.push(node.data);
        return pathSoFar;
    } else {
        // this is the starting node
        return [node.data];
    }
}

function defaultHash(node) {
    return node.toString();
}

function heapComparator(a, b) {
    return a.f - b.f;
}
