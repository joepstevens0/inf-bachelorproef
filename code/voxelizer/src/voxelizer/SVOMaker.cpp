#include "SVOMaker.h"

#include "SVOSaver.h"
#include "../opengl/texture.h"
#include "voxelizer.h"
#include "ofcSVO.h"
#include <iostream>
#include "NodeWrite.h"

const unsigned int MAX_VOXEL_IMAGE_SIZE = 1024;

SVOMaker::SVOMaker(unsigned int resolution, bool fill)
{
    unsigned int voxelImageSize = resolution;
    if (voxelImageSize > MAX_VOXEL_IMAGE_SIZE) voxelImageSize = MAX_VOXEL_IMAGE_SIZE;

    // create voxelizer
    std::cout << "Creating voxelizer...\n";
    voxelizer = new Voxelizer(voxelImageSize, voxelImageSize, voxelImageSize, fill);
    std::cout << "Voxelizer created\n";
}
SVOMaker::~SVOMaker()
{
    delete voxelizer;
    deleteTextures();
}

void SVOMaker::deleteTextures()
{
    for (auto it = textures.begin(); it != textures.end(); ++it)
    {
        delete it->second;
    }
}

Texture* SVOMaker::getTexture(const char* path)
{
    if (path == nullptr) return nullptr;
    if (textures.count(path) > 0) return textures[path];

    textures[path] = new Texture(path);
    return textures[path];
}

SVO SVOMaker::modelToSvo(glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth)
{
    if ((1 << depth) > MAX_VOXEL_IMAGE_SIZE){
        std::vector<SVO> children;
        size = size * glm::vec3(2,2,2);
        offset = offset * glm::vec3(2,2,2);
        for (uint8_t i = 0; i < 8;++i){
            float d = -1;
            glm::vec3 coffset = offset + glm::vec3(((i&1) > 0)*d,((i&2) > 0)*d,((i&4) > 0)*d);
            
            children.push_back(modelToSvo(coffset, size, model, depth-1));
        }
        return SVO{children.data()};
    }
    // voxelize mesh
    std::cout << "Voxelizing mesh...\n";

    glm::mat4 modelMatrix{1.0f};
    modelMatrix = glm::translate(modelMatrix, offset);
    modelMatrix = glm::scale(modelMatrix, size);
    Texture* tex = getTexture(model.textureFile == ""? nullptr : model.textureFile.c_str());
    std::vector<Voxel> voxels = voxelizer->voxelize(modelMatrix, model.vertices, tex);
    std::cout << "Mesh voxelized\n";

    std::cout << "Total voxels: " << voxels.size() << "\n";

    // create svo
    std::cout << "Creating SVO...\n";
    SVO svo{voxels, depth};
    std::cout << "SVO created\n";

    return svo;
}

void SVOMaker::voxelizeFile(std::ofstream &voxOut, glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth)
{
    if ((1 << depth) > MAX_VOXEL_IMAGE_SIZE){
        // depth to large for 1 renders, split it in 8
        size = size * glm::vec3(2,2,2);
        offset = offset * glm::vec3(2,2,2);
        for (uint8_t i = 0; i < 8;++i){
            float d = -1;
            glm::vec3 coffset = offset + glm::vec3(((i&1) > 0)*d,((i&2) > 0)*d,((i&4) > 0)*d);
            
            modelToSvoFile(voxOut,coffset, size, model, depth-1);
        }
    }

    glm::mat4 modelMatrix{1.0f};
    modelMatrix = glm::translate(modelMatrix, offset);
    modelMatrix = glm::scale(modelMatrix, size);
    Texture* tex = getTexture(model.textureFile == ""? nullptr : model.textureFile.c_str());
    voxelizer->voxelizeSave(voxOut,modelMatrix, model.vertices, tex);
}

std::vector<Voxel> SVOMaker::voxelize(glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth)
{
    if ((1 << depth) > MAX_VOXEL_IMAGE_SIZE){
        std::vector<Voxel> voxels;

        // double size and offset for child renders
        size = size * glm::vec3(2,2,2);
        offset = offset * glm::vec3(2,2,2);
        const float d = -1;

        unsigned int halfSize = 1 << (depth - 1);
        for (unsigned int i = 0; i < 8;++i){
            glm::vec3 coffset = offset + glm::vec3(((i&1) > 0)*d,((i&2) > 0)*d,((i&4) > 0)*d);
            std::vector<Voxel> childVoxels = voxelize(coffset, size, model, depth-1);

            if (i > 0){
                for (unsigned int j = 0; j < childVoxels.size();++j){
                    childVoxels[j].XYZ[0] += ((i&1) > 0)*halfSize;
                    childVoxels[j].XYZ[1] += ((i&2) > 0)*halfSize;
                    childVoxels[j].XYZ[2] += ((i&4) > 0)*halfSize;
                }
            }
            voxels.insert(voxels.end(), childVoxels.begin(), childVoxels.end());
        }
        return voxels;
    } else {
        glm::mat4 modelMatrix{1.0f};
        modelMatrix = glm::translate(modelMatrix, offset);
        modelMatrix = glm::scale(modelMatrix, size);
        Texture* tex = getTexture(model.textureFile == ""? nullptr : model.textureFile.c_str());
        return voxelizer->voxelize(modelMatrix, model.vertices, tex);
    }
}

void SVOMaker::create(std::ofstream &out, glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth)
{

    // voxelize mesh
    std::cout << "Voxelizing mesh...\n";
    std::vector<Voxel> voxels = voxelize(offset, size, model, depth);
    std::cout << "Mesh voxelized\n";
    std::cout << "Total voxels: " << voxels.size() << "\n";

    std::cout << "Constructing SVO\n";
    OfcSVO::create(out, voxels, depth, false);
    std::cout << "SVO constructed\n";
}

void SVOMaker::modelToSvoFile(std::ofstream &out, glm::vec3 offset, glm::vec3 size, ModelLoader::Model model, unsigned int depth)
{
    // open temp output file
    std::ofstream SVObackwardsOut("tmp/tmp_SVO_backwards", std::ios_base::binary | std::ios::out);

    create(SVObackwardsOut, offset, size, model, depth);

    SVObackwardsOut.close();

    // reverse file order
    std::ifstream SVObackwardsIn("tmp/tmp_SVO_backwards",std::ios::binary | std::ios::ate | std::ios::in);
    reverseNodeFile(out, SVObackwardsIn);
    SVObackwardsIn.close();
}

void SVOMaker::reverseNodeFile(std::ofstream &out, std::ifstream &in)
{
    std::streampos totalNodes = in.tellg()/8;
    for(int i = 1; i <= totalNodes; ++i){
        in.seekg(-i*8,std::ios::end);
        unsigned long long node;
        in.read((char*)&node, 8);
        out.write((char*)&node, 8);
    }

    std::cout << "Total nodes: " << totalNodes << "\n";
}