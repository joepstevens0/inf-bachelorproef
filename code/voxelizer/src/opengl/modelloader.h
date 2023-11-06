#ifndef MODELLOADER_H
#define MODELLOADER_H

#include <vector>
#include <string>
#include "vertex.h"

class ModelLoader
{
public:
    struct Model{
        std::vector<Vertex> vertices = {};
        std::string textureFile = "";
    };
    struct  Result
    {
        std::vector<Model> models;
    };
    
    static Result loadModel(const char* path, const char* filename);
private:
};

#endif