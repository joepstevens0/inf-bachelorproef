#ifndef OFCSVO_H
#define OFCSVO_H

#include <fstream>
#include <vector>
#include "structs.h"

class OfcSVO
{
public:
    static void create(std::ofstream &SVOout, std::vector<Voxel> voxels, unsigned int depth, bool optimized);
private:
    struct MortonVoxel{
        RGBA8 voxel;
        uint64_t mortonCode;
    };

    static void writeChildren(std::ofstream &SVOout, std::vector<Node> children, uint64_t& outPointer);
    static void processFullQueues(std::ofstream &SVOout, uint64_t& outPointer, std::vector<std::vector<Node>>& depthQueues, std::vector<uint8_t>& emptypostQueues);
    static Node processFullQueue(std::ofstream &SVOout, std::vector<Node>* children, uint64_t& outPointer);
    static void writeRoot(std::ofstream &SVOout, uint64_t& outPointer, std::vector<std::vector<Node>>& depthQueues, std::vector<uint8_t>& emptypostQueues);
    static uint64_t offsetOfPointers(uint64_t pointer1, uint64_t pointer2);
    static void addVoxelToQueue(std::vector<MortonVoxel>& mortonOrderedVoxels, uint64_t& mortonPos, uint64_t currentCode, std::vector<std::vector<Node>>& depthQueues, std::vector<uint8_t>& emptypostQueues);
    static bool allEqual(std::vector<Node> children);
    static Node readLeaf(std::ifstream &zorderVox);
    static uint8_t createChildBits(std::vector<Node> children);

    static std::vector<MortonVoxel> reorderVoxels(std::vector<Voxel> voxels);
    static bool mortonCompare(MortonVoxel a, MortonVoxel b);
    static uint64_t mortonEncode_magicbits(uint32_t x, uint32_t y, uint32_t z);
    static uint64_t splitBy3(unsigned int a);
};

#endif