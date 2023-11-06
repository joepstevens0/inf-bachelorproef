#include "shader.h"

#include <GL/glew.h>

#include <fstream>
#include <sstream>
#include <iostream>
#include <vector>

Shader::Shader(const char *vertexpath, const char *fragmentpath, const char *geometrypath)
{
    std::ifstream vertexFile{vertexpath};
    std::ifstream fragmentFile{fragmentpath};

    std::string vertexCode, fragmentCode;
    std::stringstream vertexStream, fragmentStream;

    vertexStream << vertexFile.rdbuf();
    fragmentStream << fragmentFile.rdbuf();

    vertexCode = vertexStream.str().c_str();
    fragmentCode = fragmentStream.str().c_str();

    unsigned int vertexShader, fragmentShader, geoShader;

    const char *source;
    int length;

    // create and compiler vertex shader
    vertexShader = glCreateShader(GL_VERTEX_SHADER);
    source = vertexCode.c_str();
    length = vertexCode.size();
    glShaderSource(vertexShader, 1, &source, &length);
    glCompileShader(vertexShader);
    if (!check_shader_compile_status(vertexShader))
    {
        std::cout << "vertex shader failed to compile" << std::endl;
        return;
    }

    // create and compiler fragment shader
    fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
    source = fragmentCode.c_str();
    length = fragmentCode.size();
    glShaderSource(fragmentShader, 1, &source, &length);
    glCompileShader(fragmentShader);
    if (!check_shader_compile_status(fragmentShader))
    {
        std::cout << "fragment shader failed to compile" << std::endl;
    }

    // create program
    _program = glCreateProgram();

    // attach shaders
    glAttachShader(_program, vertexShader);
    glAttachShader(_program, fragmentShader);

    if (geometrypath)
    {
        std::ifstream geoFile{geometrypath};

        std::string geoCode;
        std::stringstream geoStream;

        geoStream << geoFile.rdbuf();

        geoCode = geoStream.str().c_str();

        geoShader = glCreateShader(GL_GEOMETRY_SHADER);
        source = geoCode.c_str();
        length = geoCode.size();
        glShaderSource(geoShader, 1, &source, &length);
        glCompileShader(geoShader);
        if (!check_shader_compile_status(geoShader))
        {
            std::cout << "fragment shader failed to compile" << std::endl;
        }

        glAttachShader(_program, geoShader);
    }

    // link the program and check for errors
    glLinkProgram(_program);
    if (!check_program_link_status(_program))
    {
        std::cout << "program linking failed" << std::endl;
    }

    glDeleteShader(vertexShader);
    glDeleteShader(fragmentShader);
    if (geometrypath)
    {
        glDeleteShader(geoShader);
    }
}

Shader::~Shader()
{
    glDeleteProgram(_program);
}

bool Shader::check_shader_compile_status(unsigned int obj)
{
    GLint status;
    glGetShaderiv(obj, GL_COMPILE_STATUS, &status);
    if (status == GL_FALSE)
    {
        GLint length;
        glGetShaderiv(obj, GL_INFO_LOG_LENGTH, &length);
        std::vector<char> log(length);
        glGetShaderInfoLog(obj, length, &length, &log[0]);
        std::cout << &log[0];
        return false;
    }
    return true;
}
bool Shader::check_program_link_status(unsigned int obj)
{
    GLint status;
    glGetProgramiv(obj, GL_LINK_STATUS, &status);
    if (status == GL_FALSE)
    {
        GLint length;
        glGetProgramiv(obj, GL_INFO_LOG_LENGTH, &length);
        std::vector<char> log(length);
        glGetProgramInfoLog(obj, length, &length, &log[0]);
        std::cout << &log[0];
        return false;
    }
    return true;
}