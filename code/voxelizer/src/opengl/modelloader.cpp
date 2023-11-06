#include "modelloader.h"

#include <iostream>
#include <algorithm>
#include <map>

#define TINYOBJLOADER_IMPLEMENTATION
#include <tiny_obj_loader.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>


ModelLoader::Result ModelLoader::loadModel(const char* path, const char* filename)
{
    std::map<std::string, std::vector<Vertex>> models;
    std::string activeTex = "";

    tinyobj::attrib_t attrib;
    std::vector<tinyobj::shape_t> shapes;
    std::vector<tinyobj::material_t> materials;

    std::string warn;
    std::string err;

    bool ret = tinyobj::LoadObj(&attrib, &shapes, &materials, &warn, &err, (std::string(path) + filename).c_str(), path);

    if (!warn.empty())
    {
        std::cout << warn << std::endl;
    }
    if (!err.empty())
    {
        std::cerr << err << std::endl;
    }
    if (!ret)
    {
        exit(1);
    }

    // Loop over shapes
    for (size_t s = 0; s < shapes.size(); s++)
    {
        // Loop over faces(polygon)
        size_t index_offset = 0;
        for (size_t f = 0; f < shapes[s].mesh.num_face_vertices.size(); f++)
        {
            int fv = shapes[s].mesh.num_face_vertices[f];

            Vertex v0;
            Vertex v1;

            // Loop over vertices in the face.
            for (size_t v = 0; v < fv; v++)
            {
                // access to vertex
                tinyobj::index_t idx = shapes[s].mesh.indices[index_offset + v];
                tinyobj::real_t vx = attrib.vertices[3 * idx.vertex_index + 0];
                tinyobj::real_t vy = attrib.vertices[3 * idx.vertex_index + 1];
                tinyobj::real_t vz = attrib.vertices[3 * idx.vertex_index + 2];

                tinyobj::real_t nx = 0;
                tinyobj::real_t ny = 0;
                tinyobj::real_t nz = 0;
                if (idx.normal_index >= 0) {
                    nx = attrib.normals[3 * idx.normal_index + 0];
                    ny = attrib.normals[3 * idx.normal_index + 1];
                    nz = attrib.normals[3 * idx.normal_index + 2];
                }
                tinyobj::real_t tx = 0;
                tinyobj::real_t ty = 0;
                if (idx.texcoord_index >= 0){
                    tx = attrib.texcoords[2 * idx.texcoord_index + 0];
                    ty = attrib.texcoords[2 * idx.texcoord_index + 1];
                }
                // tinyobj::real_t red = attrib.colors[3 * idx.vertex_index + 0];
                // tinyobj::real_t green = attrib.colors[3 * idx.vertex_index + 1];
                // tinyobj::real_t blue = attrib.colors[3 * idx.vertex_index + 2];


                int mat_id = shapes[s].mesh.material_ids[f];
                tinyobj::real_t diffuse_r = 1;
                tinyobj::real_t diffuse_g = 1;
                tinyobj::real_t diffuse_b = 1;

                if (mat_id >= 0){
                    diffuse_r = materials[mat_id].diffuse[0];
                    diffuse_g = materials[mat_id].diffuse[1];
                    diffuse_b = materials[mat_id].diffuse[2];
                    activeTex = materials[mat_id].diffuse_texname;
                }
    
                Vertex vertex{{vx,vy,vz},{diffuse_r, diffuse_g, diffuse_b, 1}, {tx,ty}, {nx,ny,nz}};

                if (v ==0) v0 = vertex;
                if (v == 1) v1 = vertex;

                // triangulate mesh
                if (v > 2){
                    models[activeTex].push_back(v0);
                    models[activeTex].push_back(v1);
                }

                models[activeTex].push_back(vertex);
            }
            index_offset += fv;
        }
    }

    if (models.begin() == models.end()) return Result{};

    // find min and max point
    glm::vec3 minPoint = {models.begin()->second[0].XYZ[0], models.begin()->second[0].XYZ[1], models.begin()->second[0].XYZ[2]};
    glm::vec3 maxPoint = glm::vec3(minPoint);
    for (auto m = models.begin(); m != models.end(); m++){
        for (unsigned int i = 0; i < m->second.size();++i){
            minPoint.x = std::min(m->second[i].XYZ[0], minPoint.x);
            minPoint.y = std::min(m->second[i].XYZ[1], minPoint.y);
            minPoint.z = std::min(m->second[i].XYZ[2], minPoint.z);

            maxPoint.x = std::max(m->second[i].XYZ[0], maxPoint.x);
            maxPoint.y = std::max(m->second[i].XYZ[1], maxPoint.y);
            maxPoint.z = std::max(m->second[i].XYZ[2], maxPoint.z);
        }
    }


    glm::vec3 diff = maxPoint - minPoint;
    float dMax = std::max(std::max(diff.x, diff.y), diff.z);
    
    // normalize vertices
    for (auto m = models.begin(); m != models.end(); m++){
        for (unsigned int i = 0; i < m->second.size();++i){
            m->second[i].XYZ[0] = (m->second[i].XYZ[0] - minPoint.x)/dMax;
            m->second[i].XYZ[1] = (m->second[i].XYZ[1] - minPoint.y)/dMax;
            m->second[i].XYZ[2] = 1-(m->second[i].XYZ[2] - minPoint.z)/dMax;
        }
    }

    Result result;
    for (auto i = models.begin(); i != models.end(); i++){
        Model m;
        m.textureFile = i->first == ""? "" : path + i->first;
        m.vertices = i->second;
        result.models.push_back(m);
    }
    return result;
}