#version 300 es
precision highp float;
precision highp usampler2D;

#define STACK_SIZE 16u
#define EMPTY_TRACE TraceInfo(-1., vec3(0,0,0))
#define NOT_A_CHILD 0u
#define NO_CHILDREN_TESTED 8u
#define NODE_EXIT 8u

in vec2 vUv;
layout (location = 0) out vec4 fragColor;
layout (location = 1) out uint request;

//  Node octant numbers
//
//   ^              +-------------------+
//   |              /        /        / |
// y |             /    6   /   7    /  |
//   |            /--------+--------+   |
//   |           /        /       / | 7 |
//   |          /    2   /   3   /  |   +
//   |         +--------+-------+   | / |
//   |         |        |       | 3 |/  |
//   |         |        |       |   + 5 |
//   |      z /|   2    |   3   |  /|   +
//   |       / |        |       | / |  / 
//   |      /  |--------+-------+/  | /
//   |     /   |        |       | 1 |/ 
//   |    /    |        |       |   +  
//   |   /     |   0    |   1   |  /  
//   |  /      |        |       | /   
//   | /       +--------+-------+  
//   |/
// --+------------------------------------>
//   |                                x
//
//
// bits: <z><y><x>

/**
NODE RULES:
    - The tree root is found on node index 0
    - Every child is half the size of the parent
    - Bit number n in <children> is 1 if the node has a child for node number n
    - If <childPointer> is not 0, the children with bit 1 are found in the tree with index <childPointer> (from LSB to MSB)
    - If <childPointer> is 0, children in <children> are all leaves and not found in the tree
*/

//////////////////////////
// Structs
//////////////////////////
struct Ray{
    vec3 pos;
    vec3 dir;
};
struct TraceInfo{
    float t;
    vec3 color;
};
struct Node{
    uint pointer;
    uint children;
    uint childPointer;
    vec4 color;
};
struct StackElement{
    uint nodePointer;
    uint lastChildTested;
};
struct SizePoints{
    vec3 minPoint;
    vec3 maxPoint;
};
struct Camera{
    vec3 pos;
    mat3 rot;
    float fov;
};

//////////////////////////
// Uniforms
//////////////////////////
uniform float uResolution;  // node resolution
uniform usampler2D uDataPool;  // texture containing cache pages
uniform usampler2D uNodeLUT;    // texture containing lookup table for nodes
uniform uint uDataPoolWidth;
uniform uint uLUTWidth;
uniform uint uPageSize;
uniform uint uMaxDepth;
uniform Camera uCamera;
uniform float uPixelSize;

//////////////////////////
// Globals
//////////////////////////
StackElement stack[STACK_SIZE];
uint stackPointer = 0u;
Node currentNode;   // node currently testing
SizePoints currentPoints;   // size of the node currently testing
float nodeDist = 1.;     // distance between the camera and the point currently testing
uint dirMask = 0u;  // direction mask used when rays are negative
uint pageRequest = 0u;  // pointer to the node requested for the next render

//////////////////////////
// Node functions
//////////////////////////

/**
* Get the node from the nodeTexture with a pointer
* @param nodePointer pointer to the node
* @returns the node found at <nodePointer> in the texture
*/
Node getNode(uint nodePointer){
    // determine the page the node is in and the offset node in the page
    uint pagePointer = nodePointer/uPageSize;
    uint pageOffset = nodePointer % uPageSize;

    // find cachepointer in lookup table
    uint cachePointer = 0u;
    if (pagePointer != 0u){
        ivec2 coord = ivec2(pagePointer % uLUTWidth, floor(float(pagePointer)/float(uLUTWidth)));
        cachePointer = texelFetch(uNodeLUT, coord, 0).r;

        if (cachePointer == 0u){
            // node not in cache
            pageRequest = pagePointer;
            currentNode.children = 255u;
            currentNode.childPointer = 0u;
            return Node(nodePointer,255u, 0u, currentNode.color);
        }
    }
    cachePointer = (cachePointer*uPageSize) + pageOffset;

    // get node info from texture
    ivec2 coord = ivec2(cachePointer%(uDataPoolWidth*uPageSize), floor(float(cachePointer)/float(uDataPoolWidth*uPageSize)));
    uvec4 info = texelFetch(uDataPool, coord, 0);

    // create the node
    uint children = info.r >> 8u;
    uint childPointer = ((info.r & 0xFFu) << 16u) | info.g;

    uint r = ((info.b >> 8u) & 0xFFu);
    uint g = (info.b & 0xFFu);
    uint b = ((info.a >> 8u) & 0xFFu);
    uint a = (info.a & 0xFFu);

    vec4 color = vec4(r,g,b,a)/255.;

    return Node(nodePointer,children, childPointer, color);
}
/**
* Get the nodePointer to a child of the node
* @param node: the parent node
* @param childIndex: index of the child (3-bit number <z><y><x>)
* @returns pointer to the child in the tree or NOT_A_CHILD a child not found in the node
*/
uint getChildPointer(Node node,uint childIndex){
    // stop if node is a leafnode
    if (node.childPointer == 0u)
        return NOT_A_CHILD;

    // apply direction mask to the index
    childIndex = childIndex^dirMask;

    // count the children of the node with a smaller index
    int n = int(node.children);
    uint p = node.pointer + node.childPointer;
    while (childIndex > 0u){
        // if a child is found, increase the pointer
        if ((n & 1) > 0){
            p += 1u;
        }
        // go the the next child
        n >>= 1;
        childIndex -= 1u;
    }

    // Return the pointer if the node has the child with index <childIndex>
    if ((n & 1) > 0){
        return p;
    }

    // node does not have the child, return constant value
    return NOT_A_CHILD;
}

/**
* @returns true if node is a leafParent
*/
bool nodeIsLeafParent(Node node){
    return node.childPointer == 0u;
}

//////////////////////////
// SizePoints update functions
//////////////////////////

/**
* Get the SizePoints for a child node
* @param points SizePoints of the parent node
* @param childIndex index of the child node
* @returns SizePoints of the child node with index <childIndex>
*/
SizePoints updateSizePoints(SizePoints points, uint childIndex){
    // calculate point in the middle of the node
    vec3 midPoint = (points.maxPoint + points.minPoint)/2.;

    // update x values
    if ((childIndex & 1u ) > 0u){
        points.minPoint.x = midPoint.x;
    }else{
        points.maxPoint.x = midPoint.x;
    }
    // update y values
    if ((childIndex & 2u ) > 0u){
        points.minPoint.y = midPoint.y;
    }else{
        points.maxPoint.y = midPoint.y;
    }
    // update z values
    if ((childIndex & 4u ) > 0u){
        points.minPoint.z = midPoint.z;
    }else{
        points.maxPoint.z = midPoint.z;
    }
    return points;
}

/*
* Get the SizePoints of the parent node
* @param points SizePoints of the child node
* @param childIndex index of the child node
* @returns SizePoints of the parent node
*/
SizePoints revertSizePoints(SizePoints points, uint childIndex){
    // calculate size of the child node
    vec3 nodeSize = points.maxPoint - points.minPoint;

    // update x values
    if ((childIndex & 1u ) > 0u){
        points.minPoint.x -= nodeSize.x;
    }else{
        points.maxPoint.x += nodeSize.x;
    }
    // update y values
    if ((childIndex & 2u ) > 0u){
        points.minPoint.y -= nodeSize.y;
    }else{
        points.maxPoint.y += nodeSize.y;
    }
    // update z values
    if ((childIndex & 4u ) > 0u){
        points.minPoint.z -= nodeSize.z;
    }else{
        points.maxPoint.z += nodeSize.z;
    }
    return points;
}

//////////////////////////
// Stack functions
//////////////////////////
/**
* @returns true if the stack is empty
*/
bool stack_isEmpty(){
    return stackPointer <= 0u;
}
/**
* @returns the element at the top of te stack
*/
StackElement stack_top(){
    return stack[stackPointer-1u];
}
/**
* push a child of the current node on the stack
* @pre stack is not empty
* @param childIndex: index of the child
* @post child with index <childIndex> is on top of the stack
* or nothing happened if child does ot exist
* @post currentNode and currentPoints are updated to the new node on top of the stack
*/
void stack_push(uint childIndex){
    // update last child tested
    stack[stackPointer-1u].lastChildTested = childIndex;
    
    // get the pointer to the child 
    uint childPointer = getChildPointer(currentNode, childIndex);
    if (childPointer == NOT_A_CHILD) return;

    // create stack element and push on stack
    StackElement stackEl = StackElement(childPointer, NO_CHILDREN_TESTED);
    stack[stackPointer] = stackEl;
    stackPointer = stackPointer + 1u;

    // update the current SizePoints and Node
    currentPoints = updateSizePoints(currentPoints, childIndex);
    currentNode = getNode(stack_top().nodePointer);

    // remove children at max depth, or if node smaller then a pixel
    float size = (currentPoints.maxPoint.x - currentPoints.minPoint.x)/abs(nodeDist);
    if (stackPointer > uMaxDepth || size <= uPixelSize){
        currentNode.childPointer = 0u;
    }
}
/**
* Remove the last element from the stack
* @post last element is removed from the stack
* @post currentPoints and currentNode are updated to the new node on top of the stack
* @returns the removed element from the stack
*/
StackElement stack_pop(){
    // only pop if there is an element on the stack
    if (!stack_isEmpty()){
        stackPointer -= 1u;

        // update sizepoints if parent found on stack
        if (!stack_isEmpty()){
            // get parent element of last node
            StackElement topEl = stack_top();

            // update sizepoints
            currentPoints = revertSizePoints(currentPoints, topEl.lastChildTested);
            currentNode = getNode(topEl.nodePointer);
        }
        return stack[stackPointer];
    }
    return StackElement(0u, NO_CHILDREN_TESTED);
}

/**
* Initialize the stack
* @param firstNodePointer: pointer to the first node testing
* @param points: sizepoints of the first node
* @post node with point <firstNodePoint> is added to the stack
*/
void stack_init(uint firstNodePointer, SizePoints points){
    stack[0] = StackElement(firstNodePointer, NO_CHILDREN_TESTED);
    stackPointer = 1u;
    currentPoints = points;
    currentNode = getNode(firstNodePointer);

    // remove children at max depth
    if (stackPointer > uMaxDepth){
        currentNode.childPointer = 0u;
    }
}

//////////////////////////
// Intersect distance functions
//////////////////////////

/**
* Test if a point is inside a box
* @param minPoint of the box
* @param minPoint of the box
* @param point: the point that is tested
* @returns true if <point> is inside a box with <minPoint> and <size>
*/
bool inBox(vec3 minPoint, vec3 maxPoint, vec3 point){
    if (point.x > maxPoint.x || point.x < minPoint.x)
        return false;
    
    if (point.y > maxPoint.y || point.y < minPoint.y)
        return false;
    
    if (point.z > maxPoint.z || point.z < minPoint.z)
        return false;

    return true;
}

/**
* Get the distance a ray leaves a box
* @param maxPoint of the box
* @param ray intersecting with the box
* @returns distance until the ray has left the box or a negative value if no intersection with the box
*/
float intersectLeaveDist(vec3 maxPoint, Ray ray){
    vec3 t = (maxPoint - ray.pos)/ray.dir;
    return min(min(t.x, t.y), t.z);
}

/**
* Get the distance a ray enters a box
* @param mixPoint of the box
* @param ray intersecting with the box
* @returns distance until the ray has entered the box or a negative value if no intersection with the box
*/
float intersectEnterDist(vec3 minPoint, Ray ray){
    vec3 t = (minPoint - ray.pos)/ray.dir;
    return max(max(t.x, t.y), t.z);
}


//////////////////////////
// Node index finding functions
//////////////////////////

/**
* Get the index of the first intersecting child of a ray and a node'
* @param minPoint of the node
* @param maxPoint of the node
* @param ray intersecting with
* @pre the node and the ray have and intersection
* @returns index of the first intersecting child 
*/
uint firstNode(vec3 minPoint, vec3 maxPoint, Ray ray){
    uint answer = 0u;

    // caluclate enter, leave and middle of the node distance vor every axis
    vec3 tEnter = (minPoint - ray.pos)/ray.dir;
    vec3 tLeave = (maxPoint - ray.pos)/ray.dir;
    vec3 tMiddle = (tEnter + tLeave) /2.;

    // update node distance
    nodeDist = max(tEnter.x, max(tEnter.y, tEnter.z));

    // YZ PLANE
    if (tEnter.x > tEnter.y && tEnter.x > tEnter.z){
        if (tMiddle.y < tEnter.x){ 
            // top side
            answer |= 2u;
        }
        if (tMiddle.z < tEnter.x) {
            // back side
            answer |= 4u;
        }
        return answer;
    }
    // XZ PLANE
    if (tEnter.y > tEnter.x && tEnter.y > tEnter.z){
        if (tMiddle.x < tEnter.y){ 
            // right side
            answer |= 1u;
        }
        if (tMiddle.z < tEnter.y){
            // back side
            answer |= 4u;
        }
        return answer;
    }

    // XY PLANE
    if (tMiddle.x < tEnter.z){ 
        // right side
        answer |= 1u; 
    }
    if (tMiddle.y < tEnter.z){
        // top side
        answer |= 2u; 
    }
    return answer;
}

/**
* Get the child index of the next child intersecting with a ray on the node
* @param lastNode: index of the last node intersected with
* @param nodeMaxPoint of the last node intersected with
* @param ray intersecting with
* @returns the child index of the next node the ray intersects or NODE_EXIT if there is no next node
*/
uint nextNode(uint lastNode, vec3 nodeMaxPoint, Ray ray){
    uint nextNode = lastNode;

    // Calculate exit distance of the last child
    vec3 t = (nodeMaxPoint - ray.pos)/ray.dir;
    float tExit = min(min(t.x, t.y), t.z);

    // update node distance
    nodeDist = tExit;

    // exit to the right
    if (t.x == tExit){
        if ((lastNode & 1u) > 0u){
            // no node to the right exists
            return NODE_EXIT;
        }
        nextNode |= 1u;
    }
    // exit to the top
    if (t.y == tExit){
        if ((lastNode & 2u) > 0u){
            // no node the to top exists
            return NODE_EXIT;
        }
        nextNode |= 2u;
    }
    // exit to the back
    if (t.z == tExit){
        if ((lastNode & 4u) > 0u){
            // no node to the back exists
            return NODE_EXIT;
        }
        nextNode |= 4u;
    }

    return nextNode;
}


//////////////////////////
// Trace functions
//////////////////////////

/**
* Get the trace info between a leafparent node and a ray
* @param ray intersecting with
* @param leafParent node intersecting with
* @param points: SizePoints of the leafParent node
* @pre <leafParent> is a node wich children are all leaves
* @returns TraceInfo between <ray> and <leafParent> or EMPTY_TRACE if no intersection
*/
TraceInfo leafParentIntersect(Ray ray, Node leafParent, SizePoints points){
    // test if ray intersects with the node
    float intersectEnterDist = intersectEnterDist(points.minPoint, ray);
    float intersectLeaveDist = intersectLeaveDist(points.maxPoint, ray);
    if (intersectLeaveDist < 0. || intersectLeaveDist < intersectEnterDist){
        // no intersection
        return EMPTY_TRACE;
    }

    // get first intersecting child
    uint nodeHit = firstNode(points.minPoint, points.maxPoint, ray);

    // max 8 children can be tested (node cannot contain any more)
    int maxLoop = 8;
    while(maxLoop > 0){
        // apply direction mask on the nodeHit and test if the parent has the child
        if ((1 & (int(leafParent.children) >> (nodeHit^dirMask))) == 1){
            // leafParent has leaf with the child index
            
            // return trace info
            TraceInfo trace;
            trace.color = vec3(leafParent.color);
            // trace.color = vec3((float(nodeHit^dirMask)+1.)/8.);
            return trace;
        }

        // calculate next node hit
        SizePoints nodePoints = updateSizePoints(points, nodeHit);
        nodeHit = nextNode(nodeHit, nodePoints.maxPoint, ray);
        

        if (nodeHit == NODE_EXIT){
            // no next node, return empty trace
            return EMPTY_TRACE;
        }
        maxLoop -= 1;
    }
    
    return EMPTY_TRACE;
}

/**
* Gets the trace info between a ray and the top element on the stack
* @pre stack conatain exactly 1 element
* @post stack is empty
* @param ray intersecting with
* @returns TraceInfo between the ray an the top element of the stack
*/
TraceInfo traceStack(Ray ray){
    // trace while the stack is not empty or max stack size has been reached
    while (!stack_isEmpty() && stackPointer < STACK_SIZE){        
        // get the last element on the stack
        StackElement stackEl = stack_top();

        if (stackEl.lastChildTested == NO_CHILDREN_TESTED){
            // first time seeing this node

            if (nodeIsLeafParent(currentNode)){
                // children of the node are leaves, test if intersection with the leaves
                TraceInfo info = leafParentIntersect(ray, currentNode, currentPoints);
                if (info != EMPTY_TRACE){
                    // intersection found, return the info
                    return info;
                }

                // no intersections with the node, pop from the stack
                stack_pop();
            } else{
                // get the first intersecting child
                uint nodeHit = firstNode(currentPoints.minPoint, currentPoints.maxPoint, ray);

                // push the child on the stack
                stack_push(nodeHit);

            }
        }else{
            // node has been tested before, search for the next child
            SizePoints lastNodePoints = updateSizePoints(currentPoints ,stackEl.lastChildTested);
            uint nextNode = nextNode(stackEl.lastChildTested, lastNodePoints.maxPoint, ray);

            if (nextNode != NODE_EXIT){
                // next node exists, push it on the stack
                stack_push(nextNode);
            }else{
                // no intersections with the node, pop from the stack
                stack_pop();
            }
        }
    }

    if (stackPointer >= STACK_SIZE){
        // return red color indicating stack is too small (for debug only)
        TraceInfo trace;
        trace.color = vec3(1,0,0);
        return trace;
    }

    // no hits
    return EMPTY_TRACE;
}

/**
* Trace a ray through the octree
* @param ray intersecting with the octree
* @returns the TraceInfo for the trace with the octree and the ray or returns the EMPTY_TRACE value if no intersection
*/
TraceInfo traceOctree(Ray ray){
    // calculate the root size
    SizePoints points = SizePoints(vec3(0,0,0), vec3(uResolution));

    // make negative rays positive by setting the direction mask
    vec3 midPoint = (points.minPoint + points.maxPoint)/2.;
    if (ray.dir.x < 0.){
        ray.pos.x = (2.*midPoint.x) - ray.pos.x;
        ray.dir.x = -ray.dir.x;
        dirMask |= 1u;
    }
    if (ray.dir.y < 0.){
        ray.pos.y = (2.*midPoint.y) - ray.pos.y;
        ray.dir.y = -ray.dir.y;
        dirMask |= 2u;
    }
    if (ray.dir.z < 0.){
        ray.pos.z = (2.*midPoint.z) - ray.pos.z;
        ray.dir.z = -ray.dir.z;
        dirMask |= 4u;
    }

    // init stack with root
    stack_init(0u, points);

    // return the trace
    return traceStack(ray);
}

void main() {

    // calculate ray for current pixel
    vec3 dir = vec3(vUv, 0.5 / tan(radians(uCamera.fov) / 2.0));
    Ray ray = Ray(uCamera.pos, normalize(uCamera.rot *dir));

    // trace the ray through the octree
    TraceInfo trace = traceOctree(ray);

    vec3 color = trace.color;

    // background color
    if (trace == EMPTY_TRACE)
        color = vec3(0.1,0.1,0.1);

    // set the fragment color depending on the trace
    fragColor = vec4(color, 1);

    request = pageRequest;
    
    // // create grid
    // if ((vUv.x * 10.) - floor(vUv.x * 10.) < 0.01)
    //     fragColor = vec4(0, 0.1, 0, 1);
    // if (vUv.y * 10. - floor(vUv.y * 10.) < 0.02)
    //     fragColor = vec4(0, 0.1, 0, 1);
}