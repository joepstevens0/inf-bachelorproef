#ifndef SVOMAKER_H
#define SVOMAKER_H

#include "SVO.h"
#include "../opengl/modelloader.h"
#include <glm/gtc/matrix_transform.hpp>
#include <map>

class Voxelizer;
class Texture;

class SVOMaker
{
public:
    SVOMaker(unsigned int resolution, bool fill);
    ~SVOMaker();

    SVO modelToSvo(glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth);
    void modelToSvoFile(std::ofstream &out, glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth);
private:
    void create(std::ofstream &out, glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth);
    void voxelizeFile(std::ofstream &voxOut, glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth);
    static void reverseNodeFile(std::ofstream &out, std::ifstream &in);

    Texture* getTexture(const char* path);

    void deleteTextures();

    std::vector<Voxel> voxelize(glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth);

    std::map<std::string, Texture*> textures;
    Voxelizer* voxelizer;
};

#endif