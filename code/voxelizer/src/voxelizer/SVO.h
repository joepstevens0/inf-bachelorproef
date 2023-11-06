#ifndef SVO_H
#define SVO_H

#include "structs.h"
#include <vector>
#include <fstream>

class SVO
{
public:
    struct NestedElement{
        bool isEmpty;
        std::vector<NestedElement> children;
        unsigned int R: 8;
        unsigned int G: 8;
        unsigned int B: 8;
        unsigned int A: 8;
    };

    SVO(const std::vector<Voxel> voxels, const unsigned int depth);

    SVO(SVO children[8]);

    void addSVO(const SVO other);

    NestedElement getRoot() const { return _root;}
private:



    void addElement(Voxel voxel, NestedElement* tree, unsigned int maxDepth, float voxelSize, float offsetX, float offsetY, float offsetZ);
    void optimizeTree(NestedElement* tree);
    void optimizeEmptyElements(NestedElement* tree);
    void optimizeSolidElements(NestedElement* tree);

    static void combine(NestedElement* first, const NestedElement* second);

    NestedElement _root{true, {}, 0,0,0,0};
    unsigned int _depth;

};

#endif