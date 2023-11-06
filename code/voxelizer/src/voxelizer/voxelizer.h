#ifndef VOXELIZER_H
#define VOXELIZER_H

#include <vector>
#include <stdint.h>
#include "../opengl/vertex.h"

#include "structs.h"
#include <glm/mat4x4.hpp>
#include <fstream>


class Shader;
class Texture;

class Voxelizer{
public:
    Voxelizer(int width, int height, int depth, bool fill);
    ~Voxelizer();

    std::vector<Voxel> voxelize(glm::mat4 modelMat,std::vector<Vertex> vertices, Texture* tex = nullptr);
    void voxelizeSave(std::ofstream &out, glm::mat4 modelMat,std::vector<Vertex> vertices, Texture* tex = nullptr);
    std::vector<RGBA8> voxelizeMap(glm::mat4 modelMat,std::vector<Vertex> vertices, Texture* tex);
private:
    struct XYZW32F{
        float X = 0;
        float Y = 0;
        float Z = 0;
        float W = 0;
    };

    void createFramebuffer(int width, int height);
    void createVoxTexture(int width, int height, int depth);
    void createNormalTexture(int width, int height, int depth);
    void createVAO(std::vector<Vertex> vertices);

    void fillImage(glm::mat4 modelMat,std::vector<Vertex> vertices, Texture* tex = nullptr);

    unsigned int imageIndex(unsigned int x, unsigned int y, unsigned int z);
    RGBA8 getImageElement(unsigned int x, unsigned int y, unsigned int z);
    XYZW32F getNormalImageElement(unsigned int x, unsigned int y, unsigned int z);

    Shader* _shader;

    std::vector<RGBA8> _image;
    unsigned int _voxtex = 0;

    unsigned int _vbo,_vao;

    std::vector<XYZW32F> _normalImage;
    unsigned int _normalTex = 0;

    unsigned int _framebuffer = 0;
    unsigned int _colorTex = 0;

    int _resolution[3];
    bool _fill;
};

#endif