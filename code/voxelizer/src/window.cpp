#include "window.h"

#include <GL/freeglut.h>
#include <iostream>

Window::Window(const char* title, int width, int height)
{
    init(title, width, height);

}

Window::~Window()
{
    _windowHandle = 0;
}

void Window::init(const char* title, int width, int height)
{
    int argc = 0;
    glutInit(&argc, nullptr);

    glutInitContextVersion(4, 0);
    glutInitContextFlags(GLUT_FORWARD_COMPATIBLE);
    glutInitContextProfile(GLUT_CORE_PROFILE);

    glutSetOption(
        GLUT_ACTION_ON_WINDOW_CLOSE,
        GLUT_ACTION_GLUTMAINLOOP_RETURNS);

    glutInitWindowSize(width, height);

    glutSetOption(GLUT_MULTISAMPLE, 8);
    glutInitDisplayMode(GLUT_DEPTH | GLUT_DOUBLE | GLUT_RGBA | GLUT_MULTISAMPLE);

    _windowHandle = glutCreateWindow(title);

    if (_windowHandle < 1)
    {
        std::cerr << "ERROR: Could not create a new rendering window.\n"
                  << std::endl;
        exit(EXIT_FAILURE);
    }
}