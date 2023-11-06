#ifndef STRUCTS_H
#define STRUCTS_H

#include <vector>
#include <cstdint>

struct RGBA8{
    uint8_t R;
    uint8_t G;
    uint8_t B;
    uint8_t A;
};

struct Voxel{
    unsigned int XYZ[3];
    RGBA8 RGBA;
};

struct Node{
    RGBA8 RGBA;
    uint8_t childBits;
    unsigned long long childOffset;
    unsigned long long childPointer;
    bool referBit = false;

    static RGBA8 mixColors(std::vector<Node> children){
        float R = 0;
        float G = 0;
        float B = 0;
        float A = 0;

        int total = 0; 

        for (int i = children.size() - 1; i >= 0;--i){
            if (children[i].childBits > 0){
                R += children[i].RGBA.R;
                G += children[i].RGBA.G;
                B += children[i].RGBA.B;
                A += children[i].RGBA.A;
                total += 1;
            }
        }

        RGBA8 rgba{0,0,0,0};
        if (total > 0){
            rgba.R = R/total;
            rgba.G = G/total;
            rgba.B = B/total;
            rgba.A = A/total;
        }
        
        return rgba;

    }
};

#endif