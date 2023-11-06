#include "ofcSVO.h"
#include <iostream>
#include <algorithm>

#include "SVO.h"
#include "SVOSaver.h"
#include "NodeWrite.h"

#define TOTAL_CHILDOFFSET_BITS 23

void OfcSVO::create(std::ofstream &SVOout, std::vector<Voxel> voxels, unsigned int depth, bool optimized)
{
    // init queues
    std::vector<std::vector<Node>> depthQueues;
    std::vector<uint8_t> emptypostQueues;     // total empty elements at the end of each queue
    depthQueues.resize(depth + 1);
    emptypostQueues.resize(depth + 1, 0);

    uint64_t outPointer = 1;
    const uint64_t res = (uint64_t)1 << (uint64_t)depth;

    // reorder voxels in morton order
    std::vector<MortonVoxel> mortonOrderedVoxels = reorderVoxels(voxels);

    uint64_t mortonPos = 0;
    for (uint64_t pos = 0; pos < (res*res*res); ++pos){

        // add voxel to queue
        addVoxelToQueue(mortonOrderedVoxels, mortonPos, pos, depthQueues, emptypostQueues);

        // process all full queues
        processFullQueues(SVOout, outPointer, depthQueues, emptypostQueues);

        // write status to console
        if (pos % uint64_t((res*res*res)/100.) == 0){
            std::cout << ((float)pos/(float)(res*res*res))*100 << "%\n";
        }
    }

    writeRoot(SVOout, outPointer, depthQueues, emptypostQueues);

    NodeWrite::flush(SVOout);
}

void OfcSVO::processFullQueues(std::ofstream &SVOout, uint64_t& outPointer, std::vector<std::vector<Node>>& depthQueues, std::vector<uint8_t>& emptypostQueues)
{
    int d = depthQueues.size()-1;

    // process full queues
    while(d > 0 && (depthQueues[d].size() + emptypostQueues[d]) >= 8){
        if (emptypostQueues[d] >= 8){
            // empty queue is full, add to the bigger empty queue
            emptypostQueues[d] = 0; // clear queue
            emptypostQueues[d-1] += 1; // add to next queue
    
        } else{
            // first add the empty nodes in the empty postfix queue
            for (unsigned int i = 0; i < emptypostQueues[d];++i){
                depthQueues[d].push_back({{0,0,0,0},0, 0,0});
            }
            emptypostQueues[d] = 0; // clear empty queue

            Node parent = processFullQueue(SVOout, &depthQueues[d], outPointer);

            // add the empty nodes to the bigger queue
            for (unsigned int i = 0; i < emptypostQueues[d-1];++i){
                depthQueues[d-1].push_back({{0,0,0,0},0, 0,0});
            }
            emptypostQueues[d-1] = 0;
            depthQueues[d-1].push_back(parent); // add parent to bigger queue
        }
        d -= 1; // process next queue
    }
}

std::vector<OfcSVO::MortonVoxel> OfcSVO::reorderVoxels(std::vector<Voxel> voxels)
{
    // reorder voxels in morton order
    std::cout << "Reordering voxels in morton order...\n";

    std::vector<MortonVoxel> mortonOrderedVoxels;

    // calculate morton code for every voxel
    for (uint64_t i = 0; i < voxels.size();++i){
        Voxel* vox = &voxels[i];
        mortonOrderedVoxels.push_back({voxels[i].RGBA, mortonEncode_magicbits(voxels[i].XYZ[0],voxels[i].XYZ[1],voxels[i].XYZ[2])});
    }

    // sort the voxels by morton code
    std::sort(mortonOrderedVoxels.begin(), mortonOrderedVoxels.end(), mortonCompare);

    std::cout << "Voxels reordend\n";

    return mortonOrderedVoxels;
}

// method to seperate bits from a given integer 3 positions apart
uint64_t OfcSVO::splitBy3(unsigned int a){
    uint64_t x = a & 0x1fffff; // we only look at the first 21 bits
    x = (x | x << 32) & 0x1f00000000ffff; // shift left 32 bits, OR with self, and 00011111000000000000000000000000000000001111111111111111
    x = (x | x << 16) & 0x1f0000ff0000ff; // shift left 32 bits, OR with self, and 00011111000000000000000011111111000000000000000011111111
    x = (x | x << 8) & 0x100f00f00f00f00f; // shift left 32 bits, OR with self, and 0001000000001111000000001111000000001111000000001111000000000000
    x = (x | x << 4) & 0x10c30c30c30c30c3; // shift left 32 bits, OR with self, and 0001000011000011000011000011000011000011000011000011000100000000
    x = (x | x << 2) & 0x1249249249249249;
    return x;
}
uint64_t OfcSVO::mortonEncode_magicbits(uint32_t x, uint32_t y, uint32_t z){
    uint64_t answer = 0;
    answer |= splitBy3(x) | splitBy3(y) << 1 | splitBy3(z) << 2;
    return answer;
}

bool OfcSVO::mortonCompare(MortonVoxel a, MortonVoxel b){
    return a.mortonCode < b.mortonCode;
}

void OfcSVO::addVoxelToQueue(std::vector<MortonVoxel>& mortonOrderedVoxels, uint64_t& mortonPos, uint64_t currentCode, std::vector<std::vector<Node>>& depthQueues, std::vector<uint8_t>& emptypostQueues)
{
    unsigned int lastQIndex = depthQueues.size() - 1;
    if (mortonPos >= mortonOrderedVoxels.size() || mortonOrderedVoxels[mortonPos].mortonCode != currentCode){
        // empty node, add to empty queue
        emptypostQueues[lastQIndex] += 1;
    } else{
        // solid node, first add the empty nodes in the empty postfix queue
        for (unsigned int i = 0; i < emptypostQueues[lastQIndex];++i){
            depthQueues[lastQIndex].push_back({{0,0,0,0},0, 0,0});
        }
        emptypostQueues[lastQIndex] = 0;

        // add leaf to the queue
        Node leaf{mortonOrderedVoxels[mortonPos].voxel, 0,0,0};
        leaf.childBits = 255;
        depthQueues[lastQIndex].push_back(leaf);

        mortonPos += 1;
    }
}

void OfcSVO::writeRoot(std::ofstream &SVOout, uint64_t& outPointer, std::vector<std::vector<Node>>& depthQueues, std::vector<uint8_t>& emptypostQueues)
{
    if (emptypostQueues[0] > 0){
        // root is empty
        Node root = {{0,0,0,0}, 0,0,0};
        NodeWrite::writeNode(SVOout,root);
        return;
    }

    if (depthQueues[0].size() <= 0){
        std::cout << "Error creating SVO root not found\n";
        throw;
    }

    if (depthQueues[0][0].childPointer > 0){
        depthQueues[0][0].childOffset = 1;
    }
    Node root = depthQueues[0][0];

    NodeWrite::writeNode(SVOout,root);
}

Node OfcSVO::processFullQueue(std::ofstream &SVOout, std::vector<Node>* children, uint64_t& outPointer)
{
    Node parent;
    parent.RGBA = Node::mixColors(*children);
    parent.childOffset = 0;

    if (parent.RGBA.A <= 0){
        // node has no children, set node to an empty node
        parent.childBits = 0;
        parent.childPointer = 0;
    } else if (allEqual(*children)){
        // all children are equal, set node to a solid node
        parent.childBits = 255;
        parent.childPointer = 0;
    } else {
        // write the children
        writeChildren(SVOout, *children, outPointer);

        parent.childPointer = outPointer - 1;
        parent.childBits = createChildBits(*children);
    }
    children->clear();
    return parent;
}

bool OfcSVO::allEqual(std::vector<Node> children)
{
    RGBA8 rgba{0,0,0,0};
    bool allEqual = true;
    for (int i = 0; i < children.size();++i){
        // check if any missing children
        if (children[i].childBits != 255) return false;

        if (rgba.A == 0){
            // first node with a color
            rgba.R = children[i].RGBA.R;
            rgba.G = children[i].RGBA.G;
            rgba.B = children[i].RGBA.B;
            rgba.A = children[i].RGBA.A;
        } else{
            // compare color the color of other node
            if (children[i].RGBA.R != rgba.R) return false;
            if (children[i].RGBA.G != rgba.G) return false;
            if (children[i].RGBA.B != rgba.B) return false;
            if (children[i].RGBA.A != rgba.A) return false;
        }
    }
    return allEqual;
}

uint8_t OfcSVO::createChildBits(std::vector<Node> children)
{
    uint8_t childBits = 0;
    for (int i = 7; i >= 0; --i){
        childBits = childBits << 1;
        if (children[i].childBits > 0){
            childBits |= 1;
        }
    }
    return childBits;
}

uint64_t OfcSVO::offsetOfPointers(uint64_t pointer1, uint64_t pointer2)
{
    return pointer2 - pointer1;
}

void OfcSVO::writeChildren(std::ofstream &SVOout, std::vector<Node> children, uint64_t& outPointer)
{
    // write referrals for offsets that are too large
    for (int i = 7; i >= 0;--i){
        if (children[i].childBits > 0 && children[i].childPointer > 0){
            uint64_t offset = offsetOfPointers(children[i].childPointer, outPointer);

            if (offset >= (1 << TOTAL_CHILDOFFSET_BITS)){
                // write referral because the offset is too large
                NodeWrite::writeRefer(SVOout, offset);
                children[i].childPointer = outPointer;
                children[i].referBit = true;
                outPointer += 1;
            }
        }
    }

    // write children backwards
    for (int i = 7; i >= 0;--i){
        // test if child exists
        if (children[i].childBits > 0){
            if (children[i].childPointer > 0){
                children[i].childOffset = offsetOfPointers(children[i].childPointer, outPointer);
            }
            NodeWrite::writeNode(SVOout, children[i]);
            outPointer += 1;
        }
    }
}