#version 300 es
precision highp float;
precision highp usampler2D;

#define EMPTY_TRACE TraceInfo(vec4(0,0,0,0))
#define NOT_A_CHILD 0u
#define SOLID_NODE(nodePointer) Node(false,nodePointer,255u, 0u, currentNode.color)
#define EMPTY_NODE Node(false,0u,0u, 0u, vec4(0,0,0,0))
#define LUTSIZE (uLUTWidth*uLUTHeight)
#define HASHVALUE 1000000u


///////////////////////
/// LRU globals
/////////////////////////
#define MAX_LRU_DEPTH 30u
#define LRUTRESH 0

layout (location = 0) in vec3 aPos;

uniform uint uMapWidth;
uniform uint uMapHeight;
uniform usampler2D uLRUMap;
uniform highp uint uTimeStamp;
uint outCounter = 0u;
uint LRUout;
uint LRUstack[MAX_LRU_DEPTH];
uint stackP = 0u;
//////////////////////////
// Structs
//////////////////////////
struct Ray{
    vec3 pos;
    vec3 dir;
};
struct TraceInfo{
    vec4 color;
};
struct Node{
    bool refer;
    uint pointer;
    uint children;
    uint childPointer;
    vec4 color;
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
uniform usampler2D uDataPool;  // texture containing cache Pages
uniform usampler2D uNodeLUT;    // texture containing lookup table for nodes
uniform uint uDataPoolWidth;
uniform uint uLUTWidth;
uniform uint uLUTHeight;
uniform uint uPageSize;
uniform uint uMaxDepth;
uniform Camera uCamera;
uniform float uPixelSize;

//////////////////////////
// Globals
//////////////////////////
Ray currentRay;
Node currentNode;   // node currently testing
SizePoints currentPoints;   // size of the node currently testing
uint currentDepth;
float nodeDist = 0.;     // distance between the camera and the point currently testing
uint dirMask = 0u;  // direction mask used when rays are negative

//////////////////////////
// Node functions
//////////////////////////

uint LUTHash(uint pagePointer){
    return pagePointer % HASHVALUE;
}

/**
* Get the LUT value for a page
* @param pagePointer: number of the page
* @returns LUT value for page <pagePointer>
*/
uint getLUTvalue(uint pagePointer)
{
    uint pos = LUTHash(pagePointer);

    do{
        ivec2 coord = ivec2((3u*pos) % (3u*uLUTWidth), floor(float(3u*pos)/float(3u*uLUTWidth)));
        uint lutPage = texelFetch(uNodeLUT, coord, 0).r;
        if (lutPage == pagePointer){
            coord.x += 1;
            return texelFetch(uNodeLUT, coord, 0).r;
        }
        coord.x += 2;
        pos = texelFetch(uNodeLUT, coord, 0).r;
    } while (pos != 0u);

    return 0u;
}
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
        cachePointer = getLUTvalue(pagePointer);

        if (cachePointer == 0u){
            // node not in cache
            currentNode.children = 255u;
            currentNode.childPointer = 0u;
            return SOLID_NODE(nodePointer);
        }
    }
    LRUout = cachePointer;
    cachePointer = (cachePointer*uPageSize) + pageOffset;

    // get node info from texture
    ivec2 coord = ivec2(cachePointer%(uDataPoolWidth), floor(float(cachePointer)/float(uDataPoolWidth)));
    uvec4 info = texelFetch(uDataPool, coord, 0);

    // create the node
    uint children = (info.r >> 8u) & 0xFFu;
    bool refer = (info.r & 0x80u) > 0u;
    uint childPointer = ((info.r & 0x7Fu) << 16u) | info.g;

    uint r = ((info.b >> 8u) & 0xFFu);
    uint g = (info.b & 0xFFu);
    uint b = ((info.a >> 8u) & 0xFFu);
    uint a = (info.a & 0xFFu);

    vec4 color = vec4(r,g,b,a)/255.;

    return Node(refer,nodePointer,children, childPointer, color);
}

Node getRoot(){
    return getNode(0u);
}

uint getReferPointer(uint pointer){
    // determine the page the node is in and the offset node in the page
    uint pagePointer = pointer/uPageSize;
    uint pageOffset = pointer % uPageSize;

    // find cachepointer in lookup table
    uint cachePointer = 0u;
    if (pagePointer != 0u){
        cachePointer = getLUTvalue(pagePointer);

        if (cachePointer == 0u){
            // node not in cache
            return 0u;
        }
    }
    
    cachePointer = (cachePointer*uPageSize) + pageOffset;

    // get node info from texture
    ivec2 coord = ivec2(cachePointer%(uDataPoolWidth), floor(float(cachePointer)/float(uDataPoolWidth)));
    uvec4 info = texelFetch(uDataPool, coord, 0);
    return (info.b << 16u) | info.a;
}

/**
* Get the child of a node
* @param node: the parent node
* @param childIndex: index of the child (3-bit number <z><y><x>)
* @returns the <childIndex>th child of node <node> or EMPTY_NODE if child does not exist
*/
Node getChild(Node node,uint childIndex){
    // stop if node is a leafnode
    if (node.childPointer == 0u)
        return EMPTY_NODE;


    // apply direction mask to the index
    childIndex = childIndex^dirMask;

    // count the children of the node with a smaller index
    int n = int(node.children);
    uint p = node.pointer + node.childPointer;
    if (node.refer){
        uint r = getReferPointer(p);
        if (r == 0u){
            return SOLID_NODE(p);
        }
        p += r;
    }
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
        return getNode(p);
    }

    // node does not have the child, return constant value
    return EMPTY_NODE;
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



//////////////////////////
// Intersect distance functions
//////////////////////////


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

uint childOfPoint(vec3 minPoint, vec3 maxPoint, vec3 pos){
    uint answer = 0u;

    pos -= minPoint;
    maxPoint -= minPoint;
    vec3 mid = maxPoint/2.;

    if (pos.x >= mid.x){
        answer |= 1u;
    }
    if (pos.y >= mid.y){
        answer |= 2u;
    }
    if (pos.z >= mid.z){
        answer |= 4u;
    }

    return answer;
}

//////////////////////////////
// LRU functions
//////////////////////////////

bool pageInLRU(uint pagePointer){
    if (pagePointer == 0u) return true;
    ivec2 coord = ivec2(pagePointer % uMapHeight, floor(float(pagePointer)/float(uMapWidth)));
    uint val = texelFetch(uLRUMap, coord, 0).r;
    int time = abs(int(uTimeStamp) - int(val));
    return !(val == 0u) && !(time > LRUTRESH);
}

void pushLRU(uint LRU){
    LRUstack[stackP] = LRU;
    stackP += 1u;

    if (stackP >= MAX_LRU_DEPTH) stackP = 0u;
}
bool inLRUStack(uint LRU){
    for (uint i = 0u; i < stackP;++i){
        if (LRUstack[i] == LRU){ 
            return true;
        }
    }
    return false;
}

vec2 pixelToPos(vec2 pixel){
    vec2 pos = (pixel + vec2(1))/vec2(uMapWidth, uMapHeight);
    pos *= 2.;
    pos -= vec2(1);
    return pos;
}

vec2 scatterPos(uint value){
    vec2 pixel = vec2(value % uMapWidth, floor(float(value)/float(uMapWidth)));

    return pixelToPos(pixel);
}

bool testLRU(){
    // test if currentpage already in LRUstack or LRUmap
    if (!inLRUStack(LRUout) && !pageInLRU(LRUout)){
        if (outCounter == 0u) return true;   // return node
        // page will be added by other pixel, decrease counter and add to LRUstack
        outCounter -= 1u;
        pushLRU(LRUout);
    }
    LRUout = 0u; 
    return false;
}

//////////////////////////
// Trace functions
//////////////////////////

/**
* Move the ray to the end of the currentNode and start again from the root
* @post ray is moved to the end of the last currentNode
* @post currentNode is the root node
* @returns false if ray is now at the end of the root
*/
bool restart(){
    float leaveDist = intersectLeaveDist(currentPoints.maxPoint, currentRay);
    if (leaveDist < 0.) leaveDist = 0.;
    currentRay.pos = currentRay.pos + currentRay.dir* (leaveDist);
    nodeDist += leaveDist;

    currentNode = getRoot();
    currentPoints = SizePoints(vec3(0,0,0), vec3(uResolution));
    currentDepth = 0u;

    // test if ray still in the the root
    if (currentRay.pos.x < currentPoints.minPoint.x || currentRay.pos.x >= currentPoints.maxPoint.x ||
        currentRay.pos.y < currentPoints.minPoint.y || currentRay.pos.y >= currentPoints.maxPoint.y ||
        currentRay.pos.z < currentPoints.minPoint.z || currentRay.pos.z >= currentPoints.maxPoint.z)
        return false;
    
    return true;
}

/**
* Update the currentNode to one of its children
* @post currentNode is now the <childIndex> child of the node
* @param childIndex index of the child from the currentNode
* @returns true if success, false if no child found
*/
bool setNext(uint childIndex){
    // update sizepoints
    currentPoints = updateSizePoints(currentPoints, childIndex);

    // get the pointer to the child 
    Node child = getChild(currentNode, childIndex);
    if (child == EMPTY_NODE){
        return false;
    }

    // update Node
    currentNode = child;

    currentDepth += 1u;

    // remove children at max depth, or if node smaller then a pixel
    float size = (currentPoints.maxPoint.x - currentPoints.minPoint.x)/abs(nodeDist);
    if (currentDepth >= uMaxDepth || size <= uPixelSize){
        currentNode.childPointer = 0u;
    }

    return true;
}

/**
* Get the trace info between a leafparent node and a ray
* @pre currentRay contains the ray intersecting with
* @param leafParent node intersecting with
* @param points: SizePoints of the leafParent node
* @pre <leafParent> is a node wich children are all leaves
* @returns TraceInfo between <ray> and <leafParent> or EMPTY_TRACE if no intersection
*/
TraceInfo leafParentIntersect(Node leafParent, SizePoints points){

    // max 8 children can be tested (node cannot contain any more)
    int maxLoop = 8;
    while(maxLoop > 0){
        // get first intersecting child
        uint nodeHit = childOfPoint(points.minPoint, points.maxPoint, currentRay.pos);

        // apply direction mask on the nodeHit and test if the parent has the child
        if ((1 & (int(leafParent.children) >> (nodeHit^dirMask))) == 1){
            // leafParent has leaf with the child index
            
            // return trace info
            TraceInfo trace;
            return trace;
        }

        // move ray to next child
        SizePoints nodePoints = updateSizePoints(points, nodeHit);
        float leaveDist = intersectLeaveDist(nodePoints.maxPoint, currentRay);
        if (leaveDist < 0.) leaveDist = 0.;
        currentRay.pos = currentRay.pos + currentRay.dir*leaveDist;
        nodeDist += leaveDist;

        if (leaveDist == 0.){
            return EMPTY_TRACE;
        }
       
        
        maxLoop -= 1;
    }
    
    return EMPTY_TRACE;
}

void trace(){
    uint maxLoop = 0u - 1u;
    while (maxLoop > 0u){

        if (testLRU())
            return;

        maxLoop -= 1u;

        if (nodeIsLeafParent(currentNode)){
            // children of the node are leaves, test if intersection with the leaves
            TraceInfo info = leafParentIntersect(currentNode, currentPoints);
            if (info != EMPTY_TRACE){
                // intersection found, return the info
                return;
            }
            if (!restart()){
                return;
            }
        } else{
            // get the first intersecting child
            uint nodeHit = childOfPoint(currentPoints.minPoint, currentPoints.maxPoint, currentRay.pos);
            
            // update next child, if child not found restart
            if (!setNext(nodeHit) && !restart()){
                return;
            }
        }
    }


    // no hits
    return;
}

/**
* Create the direction mask for the ray
* @post currentRay is positive
* @post dirMask is filled
*/
void createDirMask(){
    // make negative rays positive by setting the direction mask
    vec3 midPoint = (currentPoints.minPoint + currentPoints.maxPoint)/2.;
    if (currentRay.dir.x < 0.){
        currentRay.pos.x = (2.*midPoint.x) - currentRay.pos.x;
        currentRay.dir.x = -currentRay.dir.x;
        dirMask |= 1u;
    }
    if (currentRay.dir.y < 0.){
        currentRay.pos.y = (2.*midPoint.y) - currentRay.pos.y;
        currentRay.dir.y = -currentRay.dir.y;
        dirMask |= 2u;
    }
    if (currentRay.dir.z < 0.){
        currentRay.pos.z = (2.*midPoint.z) - currentRay.pos.z;
        currentRay.dir.z = -currentRay.dir.z;
        dirMask |= 4u;
    }
}

/**
* Trace a ray through the octree
* @param ray intersecting with the octree
* @returns the TraceInfo for the trace with the octree and the ray or returns the EMPTY_TRACE value if no intersection
*/
void traceOctree(Ray ray){
    currentPoints = SizePoints(vec3(0,0,0), vec3(uResolution));
    currentRay = ray;
    currentNode = getRoot();
    currentDepth = 0u;

    if (currentDepth >= uMaxDepth){
        currentNode.childPointer = 0u;
    }

    createDirMask();

    // test if ray intersects the root
    float enterDist = intersectEnterDist(currentPoints.minPoint, currentRay);
    float leaveDist = intersectLeaveDist(currentPoints.maxPoint, currentRay);
    if (leaveDist <= 0. || leaveDist < enterDist){
        // no intersection
        LRUout = 0u;
        return;
    }

    if (enterDist < 0.) enterDist = 0.;
    // move ray into the root
    currentRay.pos = currentRay.pos + enterDist*currentRay.dir;
    nodeDist += enterDist;
    


    trace();
}

void main() {
    // calculate ray for current pixel
    vec3 dir = vec3(vec2(aPos.x - 0.5, aPos.y - 0.5), 0.5 / tan(radians(uCamera.fov) / 2.0));
    Ray ray = Ray(uCamera.pos, normalize(uCamera.rot *dir));

    LRUout = 0u;
    outCounter = uint(aPos.z);

    traceOctree(ray);

    gl_Position = vec4(scatterPos(LRUout), 0, 1);
    gl_PointSize = 1.0;
}