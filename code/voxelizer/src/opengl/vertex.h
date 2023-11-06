#ifndef VERTEX_H
#define VERTEX_H

typedef struct
{
    float XYZ[3];
    float RGBA[4];
    float Texcoord[2];
    float normal[3];
} Vertex;

#endif