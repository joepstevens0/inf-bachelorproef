#ifndef SHADER_H
#define SHADER_H


class Shader{
public:
    Shader(const char* vertexpath, const char* fragmentpath, const char* geometrypath = nullptr);
    ~Shader();

    unsigned int program() const { return _program;}
private:
    bool check_shader_compile_status(unsigned int obj);
    bool check_program_link_status(unsigned int obj);

    unsigned int _program;
};

#endif