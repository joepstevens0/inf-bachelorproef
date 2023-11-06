#include "SVO.h"

#include <iostream>

SVO::SVO(const std::vector<Voxel> voxels, const unsigned int depth)
    : _depth{depth}
{
    std::cout << " Max SVO depth:" << depth << "\n";

    for (unsigned int i = 0; i < voxels.size(); ++i)
    {
        Voxel vox = voxels[i];
        addElement(vox, &_root, depth, 1 << depth, 0, 0, 0);
    }

    std::cout << " Optimizing tree\n";
    optimizeTree(&_root);
}

void SVO::addElement(Voxel voxel, NestedElement *tree, unsigned int maxDepth, float voxelSize, float offsetX, float offsetY, float offsetZ)
{
    tree->isEmpty = false;

    if (maxDepth <= 0)
    {
        if (tree->A)
        {
            std::cerr << "Voxelisation error: two points got the same node.\n"
                         "Point: x:"
                      << voxel.XYZ[0] << "y:" << voxel.XYZ[1] << "z:" << voxel.XYZ[2] << "\n";
        }
        tree->R = voxel.RGBA.R;
        tree->G = voxel.RGBA.G;
        tree->B = voxel.RGBA.B;
        tree->A = voxel.RGBA.A;
        tree->children = {};
        return;
    }

    float halfSize = voxelSize / 2;
    unsigned int child = 0;
    // X
    if ((float)voxel.XYZ[0] + offsetX >= halfSize)
    {
        child |= 1;
        offsetX -= halfSize;
    }
    // Y
    if ((float)voxel.XYZ[1] + offsetY >= halfSize)
    {
        child |= 2;
        offsetY -= halfSize;
    }
    // Z
    if ((float)voxel.XYZ[2] + offsetZ >= halfSize)
    {
        child |= 4;
        offsetZ -= halfSize;
    }

    while (tree->children.size() < child + 1)
    {
        NestedElement el{true, {}, 0,0,0,0};
        tree->children.push_back(el);
    }
    
    // mix colors
    if (tree->A <= 0){
        // node does not yet have a color, give it the color of the voxel
        tree->R = voxel.RGBA.R;
        tree->G = voxel.RGBA.G;
        tree->B = voxel.RGBA.B;
        tree->A = voxel.RGBA.A;
    } else{
        // mix node color with color of the voxel
        tree->R = (tree->R + voxel.RGBA.R)/2;
        tree->G = (tree->G + voxel.RGBA.G)/2;
        tree->B = (tree->B + voxel.RGBA.B)/2;
        tree->A = (tree->A + voxel.RGBA.A)/2;
    }
    addElement(voxel, &tree->children[child], maxDepth - 1, halfSize, offsetX, offsetY, offsetZ);
}

void SVO::optimizeEmptyElements(NestedElement* tree)
{
    // elements without children, are fully optimized
    if (tree->children.size() <= 0)
        return;

    // empty elements don't need children
    if (tree->isEmpty){
        tree->children.clear();
        return;
    }

    bool allEmpty = true;
    bool firstSolidChildFound = false;

    for (unsigned int i = tree->children.size()-1; i > 0; --i)
    {
        optimizeEmptyElements(&tree->children[i]);

        if (tree->children[i].isEmpty)
        {
            if (!firstSolidChildFound){
                // remove empty children on the back
                tree->children.pop_back();
            }
        }
        else
        {
            firstSolidChildFound = true;
            allEmpty = false;
        }
    }


    // if all children empty, remove them
    if (allEmpty)
    {
        tree->isEmpty = true;
        tree->children.clear();
    }
}

void SVO::optimizeSolidElements(NestedElement* tree)
{
    // elements without children, are fully optimized
    if (tree->children.size() <= 0)
        return;

    if (tree->isEmpty){
        tree->children.clear();
        return;
    }

    bool allSolid = tree->children.size() >= 8; // not all solid if children missing

    for (unsigned int i = 0; i < tree->children.size(); ++i)
    {
        optimizeSolidElements(&tree->children[i]);

        // if child not all solid, element is not all solid
        if (tree->children[i].isEmpty || tree->children[i].children.size() > 0)
        {
            allSolid = false;
        }

        if (tree->children[i].R != tree->R || 
            tree->children[i].G != tree->G ||
            tree->children[i].B != tree->B || 
            tree->children[i].A != tree->A){
            // children have different colors
            allSolid = false;
        }
    }

    // if all children solid, remove them
    if (allSolid){

        tree->children.clear();
        tree->isEmpty = false;
    }
}

void SVO::optimizeTree(NestedElement *tree)
{
    //optimizeEmptyElements(tree);
    optimizeSolidElements(tree);
}

SVO::SVO(SVO children[8])
{
    _depth = 0;
    
    // add children
    for (unsigned int i = 0; i < 8; ++i){
        _root.children.push_back(children[i]._root);
        if (!children[i]._root.isEmpty){
            _root.isEmpty = false;

            // mix colors
            if (_root.A <= 0){
                // root does not yet have a color, give it the color of the child
                _root.R = children[i]._root.R;
                _root.G = children[i]._root.G;
                _root.B = children[i]._root.B;
                _root.A = children[i]._root.A;
            } else{
                // mix node color with color of the child
                _root.R = (_root.R + children[i]._root.R)/2;
                _root.G = (_root.G + children[i]._root.G)/2;
                _root.B = (_root.B + children[i]._root.B)/2;
                _root.A = (_root.A + children[i]._root.A)/2;
            }
        }

        // update depth
        if (children[i]._depth > _depth) _depth = children[i]._depth;
    }

    _depth += 1;
}

void SVO::addSVO(const SVO other)
{
    combine(&_root, &other._root);
    optimizeTree(&_root);
}

void SVO::combine(NestedElement* first, const NestedElement* second)
{
    // if empty, no elements need adding
    if (second->isEmpty) return;

    first->isEmpty = false;

    // mix colors
    if (first->A <= 0){
        // root does not yet have a color, give it the color of the child
        first->R = second->R;
        first->G = second->G;
        first->B = second->B;
        first->A = second->A;
    } else{
        // mix node color with color of the child
        first->R = (first->R + second->R)/2;
        first->G = (first->G + second->G)/2;
        first->B = (first->B + second->B)/2;
        first->A = (first->A + second->A)/2;
    }

    // add children
    for (unsigned int i = 0; i < second->children.size();++i){
        if (i < first->children.size()){
            combine(&first->children[i], &second->children[i]);
        } else{
            first->children.push_back(second->children[i]);
        }
    }
}