---
title: ElaWidgetTools 开发指南
published: 2026-06-15T17:30:00+08:00
description: "一篇AI文罢了"
tags: ["C++","Qt"]
category: 技术
draft: false
archived: false
author: CCA8798
---

> 基于 QT-Widget 开发的 FluentUI 风格组件库
> 仓库地址：<https://github.com/Liniyous/ElaWidgetTools>
> 支持 Qt 5.12+（Linux 需 5.15+），推荐 Qt 5.15.2 / Qt 6.6.2

---

## 目录

1. [安装与项目集成](#1-安装与项目集成)
2. [CMake 配置](#2-cmake-配置)
3. [代码式 UI 设计](#3-代码式-ui-设计)
4. [UI 文件式设计（Qt Designer 提升法）](#4-ui-文件式设计qt-designer-提升法)
5. [核心组件速查](#5-核心组件速查)
6. [主题与样式](#6-主题与样式)
7. [常见问题](#7-常见问题)

---

## 1. 安装与项目集成

### 方式一：Git Submodule（推荐）

```bash
cd Simple_ID_Lottery_ElaVer
git submodule add https://github.com/Liniyous/ElaWidgetTools.git
```

### 方式二：直接克隆

```bash
cd Simple_ID_Lottery_ElaVer
git clone https://github.com/Liniyous/ElaWidgetTools.git
```

### 方式三：手动下载

从 [GitHub Releases](https://github.com/Liniyous/ElaWidgetTools) 下载源码，解压后将 `ElaWidgetTools/` 目录放入项目根目录。

---

## 2. CMake 配置

### 根目录 CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.12)

project(MyProject VERSION 0.1 LANGUAGES CXX)

set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_compile_options("$<$<CXX_COMPILER_ID:MSVC>:/utf-8>")

# 配置 Qt 路径（根据实际情况修改）
SET(QT_SDK_DIR "D:/Qt/6.6.2/msvc2019_64" CACHE PATH "QT SDK DIR" FORCE)
list(APPEND CMAKE_PREFIX_PATH ${QT_SDK_DIR})

find_package(QT NAMES Qt6 Qt5 REQUIRED COMPONENTS Widgets)
find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Widgets)

# 添加 ElaWidgetTools 库
add_subdirectory(ElaWidgetTools)

# 添加你的应用程序
add_subdirectory(src)
```

### 子项目 CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.12)

project(MyApp VERSION 0.1 LANGUAGES CXX)

set(PROJECT_SOURCES
    main.cpp
    mainwindow.cpp
    mainwindow.h
    mainwindow.ui
)

if(${QT_VERSION_MAJOR} GREATER_EQUAL 6)
    qt_add_executable(${PROJECT_NAME}
        MANUAL_FINALIZATION
        ${PROJECT_SOURCES}
    )
else()
    add_executable(${PROJECT_NAME} ${PROJECT_SOURCES})
endif()

target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt${QT_VERSION_MAJOR}::Widgets
    Ela::WidgetTools          # ← 链接 ElaWidgetTools
)

set_target_properties(${PROJECT_NAME} PROPERTIES
    MACOSX_BUNDLE TRUE
    WIN32_EXECUTABLE TRUE
)

if(QT_VERSION_MAJOR EQUAL 6)
    qt_finalize_executable(${PROJECT_NAME})
endif()
```

### 关键点

| 配置项 | 说明 |
|--------|------|
| `CMAKE_AUTOMOC ON` | 必须开启，Ela 组件大量使用 Q_OBJECT 宏 |
| `CMAKE_AUTOUIC ON` | 使用 .ui 文件时必须开启 |
| `Ela::WidgetTools` | 链接 ElaWidgetTools 的 CMake 目标名 |
| `/utf-8` MSVC 标志 | 确保中文字符正常编译 |

---

## 3. 代码式 UI 设计

纯代码方式最灵活，推荐复杂界面使用。

### 3.1 应用程序入口

```cpp
#include <QApplication>
#include "ElaApplication.h"
#include "mainwindow.h"

int main(int argc, char* argv[])
{
    QApplication a(argc, argv);
    eApp->init();                          // 初始化 Ela 主题/渲染引擎
    MainWindow w;
    w.show();
    return a.exec();
}
```

`eApp` 是 `ElaApplication` 的全局单例宏，必须在所有 Ela 组件使用前调用 `eApp->init()`。

### 3.2 窗口基类选择

| 类名 | 用途 | 特点 |
|------|------|------|
| `ElaWindow` | 主窗口 | 无边框 + 导航栏 + 堆栈页面管理 |
| `ElaWidget` | 模态/弹出窗口 | 无边框模态窗口，适合对话框 |
| `ElaAppBar` | 标题栏 | 嵌入到窗口顶部，提供拖拽/缩放/按钮 |

### 3.3 使用 ElaWindow 创建主窗口

```cpp
// mainwindow.h
#include "ElaWindow.h"

class MainWindow : public ElaWindow
{
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
};

// mainwindow.cpp
#include "ElaWindow.h"
#include "ElaText.h"
#include "ElaPushButton.h"
#include "ElaLineEdit.h"
#include "ElaToggleSwitch.h"
#include "ElaComboBox.h"
#include "ElaIcon.h"
#include "ElaIconButton.h"
#include "ElaTheme.h"

MainWindow::MainWindow(QWidget* parent)
    : ElaWindow(parent)
{
    resize(1000, 700);
    setWindowTitle("我的应用");

    // ---- 导航页面内容 ----
    // 在中央堆栈中添加一个页面（页面索引 0）
    QWidget* page = new QWidget(this);
    QVBoxLayout* layout = new QVBoxLayout(page);
    layout->setContentsMargins(30, 30, 30, 30);
    layout->setSpacing(15);

    // Ela 文本
    ElaText* title = new ElaText("欢迎使用 ElaWidgetTools", this);
    title->setTextPixelSize(28);
    title->setAlignment(Qt::AlignCenter);
    layout->addWidget(title);

    // Ela 按钮
    ElaPushButton* btn = new ElaPushButton("Ela 按钮", this);
    btn->setFixedWidth(200);
    layout->addWidget(btn);

    // Ela 输入框
    ElaLineEdit* lineEdit = new ElaLineEdit(this);
    lineEdit->setPlaceholderText("Ela 风格输入框");
    lineEdit->setFixedWidth(300);
    layout->addWidget(lineEdit);

    // Ela 开关
    ElaToggleSwitch* toggle = new ElaToggleSwitch(this);
    toggle->setText("Ela 开关");
    layout->addWidget(toggle);

    // Ela 下拉框
    ElaComboBox* combo = new ElaComboBox(this);
    combo->addItems({"选项 A", "选项 B", "选项 C"});
    combo->setFixedWidth(200);
    layout->addWidget(combo);

    layout->addStretch();

    // 添加到 ElaWindow 的中央堆栈
    addCentralWidget(page);
}
```

### 3.4 使用 ElaWindow 导航系统

```cpp
// 添加导航节点
QString pageKey1, pageKey2;
addPageNode("首页", pageWidget1, pageKey1, ElaIconType::House);
addPageNode("设置", pageWidget2, pageKey2, ElaIconType::GearComplex);

// 添加可展开的分组
addExpanderNode("高级", expanderKey, ElaIconType::Folder);
addPageNode("子页面1", childWidget, expanderKey, ElaIconType::File);

// 添加底部导航
addFooterNode("关于", aboutWidget, aboutKey, 0, ElaIconType::User);

// 导航跳转
navigation(pageKey1);

// 监听导航点击
connect(this, &ElaWindow::navigationNodeClicked,
    [=](ElaNavigationType::NavigationNodeType type, QString key) {
        // 处理导航事件
    });
```

### 3.5 完整代码式示例

```cpp
#include <QApplication>
#include <QHBoxLayout>
#include <QVBoxLayout>

#include "ElaApplication.h"
#include "ElaWindow.h"
#include "ElaText.h"
#include "ElaPushButton.h"
#include "ElaLineEdit.h"
#include "ElaToggleSwitch.h"
#include "ElaComboBox.h"
#include "ElaCheckBox.h"
#include "ElaRadioButton.h"
#include "ElaComboBox.h"
#include "ElaIcon.h"

int main(int argc, char* argv[])
{
    QApplication a(argc, argv);
    eApp->init();

    ElaWindow w;
    w.setWindowTitle("代码式 UI 示例");
    w.resize(900, 600);

    // 创建页面内容
    QWidget* page = new QWidget;
    QVBoxLayout* layout = new QVBoxLayout(page);
    layout->setSpacing(12);
    layout->setContentsMargins(40, 40, 40, 40);

    layout->addWidget(new ElaText("ElaText — 文本显示", 18));
    layout->addWidget(new ElaPushButton("ElaPushButton — 按钮"));

    ElaLineEdit* edit = new ElaLineEdit;
    edit->setPlaceholderText("ElaLineEdit — 输入框");
    layout->addWidget(edit);

    layout->addWidget(new ElaToggleSwitch("ElaToggleSwitch — 开关"));
    layout->addWidget(new ElaCheckBox("ElaCheckBox — 勾选框"));

    ElaRadioButton* radio1 = new ElaRadioButton("选项 A");
    ElaRadioButton* radio2 = new ElaRadioButton("选项 B");
    layout->addWidget(radio1);
    layout->addWidget(radio2);

    ElaComboBox* combo = new ElaComboBox;
    combo->addItems({"选项 1", "选项 2", "选项 3"});
    layout->addWidget(combo);

    layout->addStretch();

    // 注册为导航页
    w.addCentralWidget(page);
    w.addPageNode("首页", page, ElaIconType::House);

    w.show();
    return a.exec();
}
```

---

## 4. UI 文件式设计（Qt Designer 提升法）

> **核心思路**：在 `.ui` 文件中先使用标准 Qt 控件（如 `QPushButton`），然后在 Qt Designer 中使用「提升为...」(Promote to) 功能，将其替换为对应的 Ela 组件类。

### 4.1 .ui 文件基本结构

```xml
<ui version="4.0">
 <class>MainWindow</class>
 <!-- base class 用 QMainWindow，实际 C++ 类继承 ElaWindow -->
 <widget class="QMainWindow" name="MainWindow">
  <widget class="QWidget" name="centralwidget">
   <layout class="QVBoxLayout">
    <item>
     <!-- 标准 QPushButton，后续提升为 ElaPushButton -->
     <widget class="QPushButton" name="elaPushButton">
      <property name="text"><string>ElaPushButton</string></property>
     </widget>
    </item>
    <item>
     <!-- 标准 QLineEdit，后续提升为 ElaLineEdit -->
     <widget class="QLineEdit" name="elaLineEdit">
      <property name="placeholderText"><string>输入内容</string></property>
     </widget>
    </item>
   </layout>
  </widget>
 </widget>
</ui>
```

### 4.2 在 Qt Designer 中提升控件

1. 在 `.ui` 文件中添加一个**标准 Qt 控件**作为占位（例如 `QPushButton` 对应 `ElaPushButton`）
2. 右键点击该控件 → **"提升为..." (Promote to)**
3. 在弹出的对话框中填写：

| 字段 | 值（示例） |
|------|-----------|
| **提升的类名称 (Promoted class name)** | `ElaPushButton` |
| **头文件 (Header file)** | `ElaPushButton.h` |
| **全局包含 (Global include)** | 勾选 |

4. 点击「添加」→「提升」

### 4.3 常用控件的提升对照表

| .ui 中占位控件 | 提升目标类 | 头文件 |
|---------------|-----------|--------|
| `QPushButton` | `ElaPushButton` | `ElaPushButton.h` |
| `QLineEdit` | `ElaLineEdit` | `ElaLineEdit.h` |
| `QComboBox` | `ElaComboBox` | `ElaComboBox.h` |
| `QCheckBox` | `ElaCheckBox` | `ElaCheckBox.h` |
| `QRadioButton` | `ElaRadioButton` | `ElaRadioButton.h` |
| `QTextEdit` / `QPlainTextEdit` | `ElaPlainTextEdit` | `ElaPlainTextEdit.h` |
| `QListWidget` / `QListView` | `ElaListView` | `ElaListView.h` |
| `QTableView` | `ElaTableView` | `ElaTableView.h` |
| `QTreeView` | `ElaTreeView` | `ElaTreeView.h` |
| `QProgressBar` | `ElaProgressBar` | `ElaProgressBar.h` |
| `QSlider` | `ElaSlider` | `ElaSlider.h` |
| `QScrollArea` | `ElaScrollArea` | `ElaScrollArea.h` |
| `QLabel` | `ElaText` | `ElaText.h` |
| `QTabWidget` | `ElaTabWidget` | `ElaTabWidget.h` |
| `QMenuBar` | `ElaMenuBar` | `ElaMenuBar.h` |
| `QToolBar` | `ElaToolBar` | `ElaToolBar.h` |
| `QStatusBar` | `ElaStatusBar` | `ElaStatusBar.h` |
| `QSpinBox` | `ElaSpinBox` | `ElaSpinBox.h` |
| `QDoubleSpinBox` | `ElaDoubleSpinBox` | `ElaDoubleSpinBox.h` |
| `QLCDNumber` | `ElaLCDNumber` | `ElaLCDNumber.h` |
| `QDockWidget` | `ElaDockWidget` | `ElaDockWidget.h` |

### 4.4 窗口基类的处理

`.ui` 文件中将 base class 设为 `QMainWindow`，但实际 C++ 继承 `ElaWindow` 或 `ElaWidget`：

```cpp
// mainwindow.h
#include "ElaWindow.h"        // 或者 ElaWidget.h

QT_BEGIN_NAMESPACE
namespace Ui { class MainWindow; }
QT_END_NAMESPACE

class MainWindow : public ElaWindow  // 而不是 QMainWindow
{
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
    ~MainWindow();
private:
    Ui::MainWindow* ui;
};

// mainwindow.cpp
#include "mainwindow.h"
#include "ui_mainwindow.h"

MainWindow::MainWindow(QWidget* parent)
    : ElaWindow(parent)     // ← 基类匹配 ElaWindow
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);      // 正常运行，ElaWindow 是 QMainWindow 的子类

    // 继续使用 Ela 特有的 API
    setWindowTitle("UI 文件 + Ela");
    addCentralWidget(new QWidget(this));  // ElaWindow 特有
}
```

### 4.5 混用 .ui 与代码

最实用的方式是：**用 `.ui` 设计界面布局，用代码配置 Ela 特有行为**。

```cpp
MainWindow::MainWindow(QWidget* parent)
    : ElaWindow(parent)
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);

    // 通过代码调用 Ela 特有 API（.ui 无法直接配置的内容）
    setIsCentralStackedWidgetTransparent(true);
    setUserInfoCardVisible(false);

    // 连接信号（ElaPushButton 在 .ui 中被提升后，可直接用 ui 指针访问）
    connect(ui->elaPushButton, &ElaPushButton::clicked, this, [=]() {
        // 处理点击
    });

    // 设置导航
    addPageNode("主页", ui->centralwidget, ElaIconType::House);
}
```

---

## 5. 核心组件速查

### 5.1 窗口类

| 组件 | 用途 | 核心方法 |
|------|------|---------|
| `ElaWindow` | 带导航栏的主窗口 | `addCentralWidget()`, `addPageNode()`, `navigation()`, `addFooterNode()` |
| `ElaWidget` | 无边框模态窗口 | 类似 `QWidget` 但自带无边框和圆角 |
| `ElaAppBar` | 标题栏组件 | 集成在 ElaWindow 中，支持自定义中间区域 `setCustomWidget()` |
| `ElaContentDialog` | 带遮罩的对话框 | `exec()` 模态显示，`rightButtonClicked` / `middleButtonClicked` 信号 |
| `ElaDrawerArea` | 抽屉面板 | 从边缘滑出的面板 |

### 5.2 基础控件

| 组件 | 对应 Qt 类 | 额外特性 |
|------|-----------|---------|
| `ElaPushButton` | `QPushButton` | Fluent 风格，支持主题色 |
| `ElaIconButton` | `QPushButton` | 纯图标按钮，支持 ElaIcon 图标 |
| `ElaCheckBox` | `QCheckBox` | 动画勾选效果 |
| `ElaRadioButton` | `QRadioButton` | 动画单选效果 |
| `ElaToggleSwitch` | (无对应) | Fluent 风格的开关按钮 |
| `ElaLineEdit` | `QLineEdit` | 圆角输入框，支持搜索样式 |
| `ElaComboBox` | `QComboBox` | Fluent 下拉菜单 |
| `ElaSpinBox` / `ElaDoubleSpinBox` | `QSpinBox` / `QDoubleSpinBox` | 微调框 |
| `ElaSlider` | `QSlider` | Fluent 滑块 |
| `ElaProgressBar` | `QProgressBar` | 支持不确定模式 |
| `ElaProgressRing` | (无对应) | 环形进度条 |
| `ElaText` | `QLabel` | 支持像素字号设置 |

### 5.3 视图与容器

| 组件 | 用途 |
|------|------|
| `ElaListView` | 列表视图 |
| `ElaTableView` | 表格视图 |
| `ElaTreeView` | 树形视图 |
| `ElaTabBar` / `ElaTabWidget` | Chrome 风格选项卡 |
| `ElaScrollArea` | 滚动区域（支持鼠标拖动） |
| `ElaScrollPage` | 滚动页面 + 面包屑导航 |
| `ElaFlowLayout` | 流式布局（带动画） |

### 5.4 导航与菜单

| 组件 | 用途 |
|------|------|
| `ElaPivot` | 轴转导航（顶部选项卡导航） |
| `ElaBreadcrumbBar` | 面包屑导航 |
| `ElaMenu` | Fluent 风格菜单（支持图标） |
| `ElaMenuBar` | 菜单栏 |
| `ElaToolBar` | 工具栏 |
| `ElaToolButton` | 带下拉菜单的工具按钮 |
| `ElaSuggestBox` | 建议搜索框 |

### 5.5 卡片与展示

| 组件 | 用途 |
|------|------|
| `ElaImageCard` | 图片卡片 |
| `ElaPopularCard` | 热门卡片 |
| `ElaPromotionCard` | 促销卡片 |
| `ElaPromotionView` | 促销卡片视窗 |
| `ElaInteractiveCard` | 交互式透明卡片 |
| `ElaReminderCard` | 提醒卡片 |
| `ElaAcrylicUrlCard` | 亚克力 URL 卡片 |
| `ElaCalendar` | 日历视图 |
| `ElaCalendarPicker` | 日期选择器 |
| `ElaRoller` | 无限滚筒选择器 |

### 5.6 工具与功能

| 组件 | 用途 |
|------|------|
| `ElaApplication` | 程序初始化（`eApp->init()`） |
| `ElaTheme` | 主题管理器（`eTheme->setThemeMode()`） |
| `ElaIcon` | 图标系统（`ElaIconType::*` 枚举） |
| `ElaLog` | 消息日志 |
| `ElaEventBus` | 事件总线 |
| `ElaKeyBinder` | 单按键绑定 |
| `ElaActionCommander` | 撤销/重做命令管理器 |
| `ElaDxgiManager` | DXGI 屏幕采集 |
| `ElaExponentialBlur` | 指数模糊效果 |

---

## 6. 主题与样式

### 6.1 主题切换

```cpp
#include "ElaTheme.h"

// 获取主题管理器（全局单例）
ElaTheme* theme = eTheme;

// 设置主题（Light / Dark）
theme->setThemeMode(ElaThemeType::Light);
theme->setThemeMode(ElaThemeType::Dark);

// 获取当前主题
ElaThemeType::ThemeMode mode = theme->getThemeMode();
```

### 6.2 窗口绘制模式

```cpp
// 设置窗口背景图片（明/暗双主题）
setWindowPixmap(ElaThemeType::Light, QPixmap(":/images/light_bg.png"));
setWindowPixmap(ElaThemeType::Dark,  QPixmap(":/images/dark_bg.png"));

// 设置窗口背景动画
setWindowMoviePath(ElaThemeType::Light, ":/images/light.gif");
setWindowMoviePath(ElaThemeType::Dark,  ":/images/dark.gif");

// 切换绘制模式
setWindowPaintMode(ElaWindowType::PaintMode::Pixmap);

// Windows 11 支持 Mica / Acrylic
eApp->setWindowDisplayMode(ElaApplicationType::Mica);
```

### 6.3 图标系统

```cpp
#include "ElaIcon.h"

// 直接在 Ela 组件上设置图标
ElaIconButton* iconBtn = new ElaIconButton(ElaIconType::House, this);

// 在菜单中使用图标
menu->addElaIconAction(ElaIconType::GearComplex, "设置");

// 在按钮中使用
pushButton->setElaIcon(ElaIconType::CheckMark);

// 所有图标枚举见 ElaIconType
```

---

## 7. 常见问题

### Q1: 编译时找不到 Ela 头文件

确保：
- `ElaWidgetTools` 目录已正确放置在项目中
- CMake 配置了 `add_subdirectory(ElaWidgetTools)`
- 正确链接了 `Ela::WidgetTools`
- 头文件包含路径正确（默认自动包含）

### Q2: 运行时崩溃或无界面显示

- 确保在创建任何 Ela 组件之前调用 `eApp->init()`
- Qt 版本需在支持范围内（5.12+ / 5.15+ for Linux）
- 如果是静态编译，需设置 `ELAWIDGETTOOLS_BUILD_STATIC_LIB`

### Q3: .ui 文件中提升的 Ela 控件不起作用

- 确认头文件名正确（如 `ElaPushButton.h` 不是 `elapushbutton.h`）
- 确认在 Qt Designer 的「提升的控件」列表中已正确添加
- 提升后保存 .ui 文件，重新运行 CMake 配置
- 也可以在 .ui 文件中直接编辑 XML 添加 `<customwidgets>` 段

### Q4: 如何混合使用 .ui 和代码？

最佳实践：
1. 使用 `.ui` 进行布局设计（拖拽控件、设置边距、层级等）
2. 在 C++ 代码中调用 Ela 特有 API（如导航注册、主题配置、信号连接）
3. 先在 `.ui` 中放置标准 Qt 控件并提升为 Ela 版本，然后在代码中通过 `ui->` 指针访问

### Q5: 能否在 QML 中使用？

不能。ElaWidgetTools 是基于 Qt Widgets 的库，不兼容 QML/Qt Quick。

---

## 附录：项目目录结构

建议的项目结构：

```
MyProject/
├── CMakeLists.txt              # 根 CMake，引用 ElaWidgetTools 和 src
├── ElaWidgetTools/             # 克隆或子模块
│   ├── CMakeLists.txt
│   ├── ElaWindow.h
│   ├── ElaPushButton.h
│   └── ...
├── src/
│   ├── CMakeLists.txt
│   ├── main.cpp
│   ├── mainwindow.h
│   ├── mainwindow.cpp
│   └── mainwindow.ui
├── resources/
│   ├── resources.qrc
│   └── images/
└── README.md
```

---

> 更多信息请参阅 [ElaWidgetTools GitHub 仓库](https://github.com/Liniyous/ElaWidgetTools)  
> 问题反馈请加入 QQ 群：850243692



# ElaWidgetTools开发文档(API/函数)

> 基于 Qt5/Qt6 的现代 Windows UI 组件库，提供类 Win11 风格的界面元素。

---

## 目录

- [入门示例](#入门示例)
- [窗口组件](#一窗口组件)
- [导航与页面](#二导航与页面)
- [按钮组件](#三按钮组件)
- [输入组件](#四输入组件)
- [选择组件](#五选择组件)
- [显示组件](#六显示组件)
- [布局组件](#七布局组件)
- [对话框与消息](#八对话框与消息)
- [事件系统](#九事件系统)
- [菜单与工具栏](#十菜单与工具栏)
- [卡片组件](#十一卡片组件)
- [工具组件](#十二工具组件)
- [其他组件](#十三其他组件)

---

## 入门示例

### 项目结构

```
MyProject/
├── CMakeLists.txt
├── main.cpp
├── mainwindow.h
├── mainwindow.cpp
└── pages/
    ├── homepage.h
    ├── homepage.cpp
    ├── settingspage.h
    └── settingspage.cpp
```

### CMakeLists.txt（以静态库链接 ElaWidgetTools）

```cmake
cmake_minimum_required(VERSION 3.16)
project(MyElaApp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

add_definitions(-DELAWIDGETTOOLS_LIBRARY)

# ElaWidgetTools 作为静态库
set(ELAWIDGETTOOLS_BUILD_STATIC_LIB ON CACHE BOOL "" FORCE)
add_subdirectory(thirdparty/ElaWidgetTools/ElaWidgetTools)

find_package(Qt6 COMPONENTS Widgets REQUIRED)

add_executable(MyElaApp
    main.cpp
    mainwindow.h mainwindow.cpp
    pages/homepage.h pages/homepage.cpp
    pages/settingspage.h pages/settingspage.cpp
)

target_link_libraries(MyElaApp PRIVATE
    Ela::WidgetTools
    Qt6::Widgets
)

target_include_directories(MyElaApp PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
```

### main.cpp

```cpp
#include <QApplication>
#include "ElaApplication.h"
#include "mainwindow.h"

int main(int argc, char* argv[])
{
    QApplication a(argc, argv);
    // 初始化 ElaApplication（必须在所有 Ela 窗口之前创建）
    eApp->init();
    MainWindow w;
    w.show();
    return a.exec();
}
```

### mainwindow.h

```cpp
#pragma once
#include <QMainWindow>
#include "ElaWindow.h"

class MainWindow : public ElaWindow
{
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
    ~MainWindow() = default;
};
```

### mainwindow.cpp

```cpp
#include "mainwindow.h"
#include "pages/homepage.h"
#include "pages/settingspage.h"

MainWindow::MainWindow(QWidget* parent)
    : ElaWindow(parent)
{
    resize(1200, 800);
    setWindowTitle("ElaWidgetTools 演示");
    moveToCenter();

    // 设置导航栏显示模式
    setNavigationBarDisplayMode(ElaNavigationType::Auto);
    // 设置页面切换动效
    setStackSwitchMode(ElaWindowType::Popup);
    // 设置用户信息卡片
    setUserInfoCardVisible(true);
    setUserInfoCardTitle("用户");
    setUserInfoCardSubTitle("user@example.com");

    // 添加导航节点
    QString expanderKey;
    addExpanderNode("基础组件", expanderKey, ElaIconType::Star);

    QString subKey;
    addPageNode("首页", new HomePage(), ElaIconType::House);
    addPageNode("按钮", new QWidget(), expanderKey, ElaIconType::ArrowPointer);
    addPageNode("输入框", new QWidget(), expanderKey, ElaIconType::Pencil);

    QString settingsKey;
    addPageNode("设置", new SettingsPage(), ElaIconType::Gear);

    // 添加页脚节点
    QString footerKey;
    addFooterNode("关于", footerKey, 0, ElaIconType::CircleInfo);

    // 导航到首页
    navigation("首页");
}
```

### 页面示例 — pages/homepage.h

```cpp
#pragma once
#include "ElaScrollPage.h"

class HomePage : public ElaScrollPage
{
    Q_OBJECT
public:
    explicit HomePage(QWidget* parent = nullptr);
};
```

### pages/homepage.cpp

```cpp
#include "homepage.h"
#include <QVBoxLayout>
#include "ElaText.h"
#include "ElaPushButton.h"
#include "ElaScrollPageArea.h"

HomePage::HomePage(QWidget* parent)
    : ElaScrollPage(parent)
{
    setTitleVisible(true);
    setPageTitleSpacing(10);

    auto* title = new ElaText("欢迎使用 ElaWidgetTools", this);
    title->setTextStyle(ElaTextType::Title);

    auto* subtitle = new ElaText("基于 Qt 的现代化 Windows UI 组件库", this);
    subtitle->setTextPixelSize(14);

    auto* button = new ElaPushButton("开始使用", this);
    button->setBorderRadius(8);

    // 使用 ElaScrollPageArea 包裹内容区域
    auto* area = new ElaScrollPageArea(this);
    auto* layout = new QVBoxLayout(area);
    layout->addWidget(title);
    layout->addWidget(subtitle);
    layout->addWidget(button);
    layout->addStretch();

    // 将 area 添加到 scroll page 的中央
    addCentralWidget(area, true, true, 0.5);
}
```

---

## 一、窗口组件

### 1.1 ElaApplication

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaApplication.h` |
| **功能简介** | 应用程序级单例，管理全局显示模式（Mica/Acrylic/Blur 等效果）、初始化 D2D 渲染环境 |
| **继承关系** | `QObject` |
| **关键 API** | `static ElaApplication* getInstance()` — 获取单例<br>`void init()` — 初始化（必须在窗口创建前调用）<br>`void setWindowDisplayMode(ElaApplicationType::WindowDisplayMode)` — 设置窗口背景效果<br>`void syncWindowDisplayMode(QWidget*, bool)` — 同步显示模式到目标窗口 |

```cpp
#include <QApplication>
#include "ElaApplication.h"

int main(int argc, char* argv[])
{
    QApplication a(argc, argv);
    eApp->init();

    // 设置背景为云母效果
    eApp->setWindowDisplayMode(ElaApplicationType::ElaMica);

    // ...创建窗口
    return a.exec();
}
```

### 1.2 ElaWidget

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaWidget.h` |
| **功能简介** | 带自定义标题栏的独立窗口，支持 Win11 圆角、云母效果 |
| **继承关系** | `QWidget` |
| **关键 API** | `void moveToCenter()` — 居中显示<br>`void setWindowButtonFlag(ElaAppBarType::ButtonType, bool)` — 控制窗口按钮显隐<br>`void setWindowButtonFlags(ElaAppBarType::ButtonFlags)` — 批量设置按钮标志 |

```cpp
#include "ElaWidget.h"
#include "ElaPushButton.h"
#include <QVBoxLayout>

ElaWidget* widget = new ElaWidget();
widget->setWindowTitle("独立窗口");
widget->resize(600, 400);
widget->moveToCenter();

// 隐藏最大化按钮
widget->setWindowButtonFlag(ElaAppBarType::MaximizeButtonHint, false);

auto* btn = new ElaPushButton("关闭窗口");
QObject::connect(btn, &ElaPushButton::clicked, widget, &ElaWidget::close);

auto* layout = new QVBoxLayout(widget);
layout->addWidget(btn);
widget->show();
```

### 1.3 ElaDialog

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaDialog.h` |
| **功能简介** | 带自定义标题栏的模态/非模态对话框 |
| **继承关系** | `QDialog` |
| **关键 API** | `void moveToCenter()` — 居中<br>`void setWindowButtonFlag(...)` — 控制按钮显示 |

```cpp
#include "ElaDialog.h"
#include "ElaText.h"
#include <QVBoxLayout>

ElaDialog* dlg = new ElaDialog(parentWidget);
dlg->setWindowTitle("提示");
dlg->resize(400, 200);
dlg->moveToCenter();

auto* layout = new QVBoxLayout(dlg);
layout->addWidget(new ElaText("这是一个 ElaDialog"));
dlg->exec();
```

### 1.4 ElaWindow

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaWindow.h` |
| **功能简介** | 主窗口容器，集成了导航栏、标题栏、页面栈，是应用的骨架 |
| **继承关系** | `QMainWindow` |
| **关键 API** | `addPageNode(title, page, icon)` — 添加页面节点<br>`addExpanderNode(title, key, icon)` — 添加可展开分组<br>`addFooterNode(title, key, points, icon)` — 添加页脚节点<br>`addCategoryNode(title, key)` — 添加分类标题<br>`addCentralWidget(widget)` — 添加中央自定义组件<br>`navigation(pageKey)` — 导航到指定页面<br>`setUserInfoCardVisible(bool)` — 显示用户信息卡片<br>`setWindowButtonFlag(type, bool)` — 控制窗口按钮<br>`setNavigationBarDisplayMode(mode)` — 导航栏展开/折叠模式<br>`setStackSwitchMode(mode)` — 页面切换动画<br>`moveToCenter()` — 居中 |

```cpp
#include "ElaWindow.h"
#include "ElaIcon.h"

// 创建窗口
ElaWindow* window = new ElaWindow();
window->resize(1200, 800);
window->moveToCenter();

// 添加展开分组（可折叠的导航组）
QString groupKey;
window->addExpanderNode("编辑", groupKey, ElaIconType::Pencil);

// 在分组下添加页面
window->addPageNode("文本编辑", new QWidget(), groupKey, ElaIconType::Font);

// 添加直接显示的页面（不在分组中）
window->addPageNode("仪表盘", new QWidget(), ElaIconType::GaugeHigh);

// 添加带角标的页面
window->addPageNode("消息", new QWidget(), 5, ElaIconType::Bell);  // 5 为角标数字

// 添加分类节点（纯文字分类标题）
QString categoryKey;
window->addCategoryNode("系统", categoryKey, groupKey);

// 添加页脚节点
QString footerKey;
window->addFooterNode("设置", footerKey, 0, ElaIconType::Gear);

// 导航到第一个页面
window->navigation("仪表盘");

// 响应导航点击
QObject::connect(window, &ElaWindow::navigationNodeClicked,
    [](ElaNavigationType::NavigationNodeType nodeType, QString nodeKey) {
        // nodeType: PageNode / FooterNode / CategoryNode
        qDebug() << "Navigated to:" << nodeKey;
    });

window->show();
```

### 1.5 ElaAppBar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaAppBar.h` |
| **功能简介** | 自定义标题栏组件，含窗口按钮（最小化/最大化/关闭）、导航按钮、主题切换、路由按钮 |
| **继承关系** | `QWidget` |
| **关键 API** | `setCustomWidget(area, widget)` — 在标题栏左/中/右区域添加自定义组件<br>`setCustomMenu(QMenu*)` — 设置标题栏菜单<br>`setWindowButtonFlag(type, bool)` — 控制按钮显隐<br>`setRouteBackButtonEnable(bool)` — 启用路由返回 |

```cpp
#include "ElaAppBar.h"
#include "ElaIconButton.h"

ElaAppBar* appBar = new ElaAppBar(window);
// 在标题栏右侧添加自定义搜索按钮
auto* searchBtn = new ElaIconButton(ElaIconType::MagnifyingGlass, 16);
appBar->setCustomWidget(ElaAppBarType::RightArea, searchBtn);

// 隐藏主题切换按钮
appBar->setWindowButtonFlag(ElaAppBarType::ThemeChangeButtonHint, false);

// 启用路由导航按钮
appBar->setRouteBackButtonEnable(true);
QObject::connect(appBar, &ElaAppBar::routeBackButtonClicked, []() {
    qDebug() << "Back";
});
```

---

## 二、导航与页面

### 2.1 ElaNavigationBar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaNavigationBar.h` |
| **功能简介** | 侧边导航栏，支持多层展开/折叠、节点增删改、角标 |
| **继承关系** | `QWidget` |
| **关键 API** | `addExpanderNode(title, key, icon)` — 展开组<br>`addPageNode(title, page, icon)` — 页面节点（可指定父分组）<br>`addFooterNode(title, key, points, icon)` — 页脚<br>`addCategoryNode(title, key)` — 分类标题<br>`expandNode(key)` / `collapseNode(key)` — 展开/折叠<br>`navigation(pageKey, isLogClicked, isRouteBack)` — 导航<br>`setDisplayMode(mode)` — Minimal/Compact/Maximal/Auto<br>`removeNode(key)` — 删除节点<br>`setNodeKeyPoints(key, points)` — 设置角标 |

```cpp
#include "ElaNavigationBar.h"
#include "ElaIcon.h"

ElaNavigationBar* navBar = new ElaNavigationBar(parent);
navBar->setFixedWidth(260);

// 添加分组
QString expKey;
navBar->addExpanderNode("文件", expKey, ElaIconType::File);

// 在分组下添加页面
navBar->addPageNode("打开", new QWidget(), expKey, ElaIconType::FolderOpen);
navBar->addPageNode("保存", new QWidget(), expKey, ElaIconType::FloppyDisk);

// 直接添加页面（不在分组中）
navBar->addPageNode("主页", new QWidget(), ElaIconType::House);

// 设置角标
navBar->setNodeKeyPoints("消息", 3);

// 展开节点
navBar->expandNode(expKey);

// 导航
navBar->navigation("主页");
```

### 2.2 ElaScrollPage

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaScrollPage.h` |
| **功能简介** | 带滚动、标题栏和导航栈的可滚动页面容器 |
| **继承关系** | `QWidget` |
| **关键 API** | `addCentralWidget(widget, resizeable, gestureEnabled, delay)` — 添加中央内容<br>`navigation(index, isLogRoute)` — 页面内导航<br>`setTitleVisible(bool)` — 显示/隐藏标题<br>`setPageTitleSpacing(int)` — 标题间距<br>`setCustomWidget(QWidget*)` — 自定义标题栏右侧组件 |

```cpp
#include "ElaScrollPage.h"
#include "ElaScrollPageArea.h"
#include "ElaText.h"
#include "ElaPushButton.h"
#include <QVBoxLayout>
#include <QHBoxLayout>

ElaScrollPage* page = new ElaScrollPage();

// 显示标题区域
page->setTitleVisible(true);

// 标题栏右侧添加自定义按钮
auto* refreshBtn = new ElaPushButton("刷新");
page->setCustomWidget(refreshBtn);

// 创建内容区域 1
auto* area1 = new ElaScrollPageArea();
auto* layout1 = new QVBoxLayout(area1);
layout1->addWidget(new ElaText("区域一", ElaTextType::Subtitle, page));
layout1->addWidget(new ElaPushButton("按钮一"));

// 创建内容区域 2
auto* area2 = new ElaScrollPageArea();
auto* layout2 = new QVBoxLayout(area2);
layout2->addWidget(new ElaText("区域二", ElaTextType::Subtitle, page));
layout2->addWidget(new ElaPushButton("按钮二"));

// 用主容器组装
auto* container = new QWidget();
auto* mainLayout = new QVBoxLayout(container);
mainLayout->addWidget(area1);
mainLayout->addWidget(area2);
mainLayout->addStretch();

// 设置为页面中央内容
page->addCentralWidget(container, true, true, 0.5);
```

### 2.3 ElaScrollPageArea

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaScrollPageArea.h` |
| **功能简介** | 在 ElaScrollPage 中使用的卡片式区域容器，自带圆角背景 |
| **继承关系** | `QWidget` |

```cpp
#include "ElaScrollPageArea.h"
#include <QVBoxLayout>

auto* area = new ElaScrollPageArea(scrollPage);
area->setBorderRadius(8);

auto* layout = new QVBoxLayout(area);
layout->setContentsMargins(20, 12, 20, 12);
layout->addWidget(new ElaText("卡片内容"));
```

### 2.4 ElaPivot

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaPivot.h` |
| **功能简介** | 水平切换标签（类似导航标签页），带下划线指示器 |
| **继承关系** | `QWidget` |
| **关键 API** | `appendPivot(title)` — 添加标签<br>`removePivot(title)` — 删除标签<br>`setCurrentIndex(int)` — 设置当前选中<br>`getCurrentIndex()` — 获取当前索引 |

```cpp
#include "ElaPivot.h"
#include <QStackedWidget>

ElaPivot* pivot = new ElaPivot(parent);
pivot->appendPivot("首页");
pivot->appendPivot("发现");
pivot->appendPivot("我的");

QStackedWidget* stack = new QStackedWidget();
stack->addWidget(new QWidget());  // 首页内容
stack->addWidget(new QWidget());  // 发现内容
stack->addWidget(new QWidget());  // 我的内容

QObject::connect(pivot, &ElaPivot::pivotClicked, stack, [stack](int index) {
    stack->setCurrentIndex(index);
});
```

### 2.5 ElaBreadcrumbBar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaBreadcrumbBar.h` |
| **功能简介** | 面包屑导航条，可动态增删路径 |
| **继承关系** | `QWidget` |
| **关键 API** | `setBreadcrumbList(list)` — 设置完整路径<br>`appendBreadcrumb(breadcrumb)` — 追加<br>`removeBreadcrumb(breadcrumb)` — 移除<br>`getBreadcrumbList()` — 获取当前路径列表 |

```cpp
#include "ElaBreadcrumbBar.h"

ElaBreadcrumbBar* bread = new ElaBreadcrumbBar(parent);
bread->setBreadcrumbList({"首页", "文档", "指南"});

// 追加路径
bread->appendBreadcrumb("API 参考");

// 点击面包屑响应
QObject::connect(bread, &ElaBreadcrumbBar::breadcrumbClicked,
    [](QString breadcrumb, QStringList lastList) {
        qDebug() << "Clicked:" << breadcrumb;
        qDebug() << "Remaining:" << lastList;
    });
```

### 2.6 ElaSuggestBox

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaSuggestBox.h` |
| **功能简介** | 带建议搜索框的输入组件，支持图标+文字建议项 |
| **继承关系** | `QWidget` |
| **关键 API** | `addSuggestion(text, data)` — 添加建议<br>`addSuggestion(icon, text, data)` — 带图标的建议<br>`addSuggestion(SuggestData)` — 使用数据结构添加<br>`removeSuggestion(key)` — 删除建议<br>`clearSuggestion()` — 清空建议<br>`setPlaceholderText(text)` — 设置占位文本 |

```cpp
#include "ElaSuggestBox.h"
#include "ElaIcon.h"

ElaSuggestBox* suggestBox = new ElaSuggestBox(parent);
suggestBox->setPlaceholderText("搜索...");
suggestBox->setFixedSize(300, 36);

// 添加建议项
suggestBox->addSuggestion(ElaIconType::House, "首页");
suggestBox->addSuggestion(ElaIconType::Gear, "设置");
suggestBox->addSuggestion(ElaIconType::File, "文档");

// 使用 SuggestData 结构
ElaSuggestBox::SuggestData data;
data.setElaIcon(ElaIconType::Star);
data.setSuggestText("收藏");
data.setSuggestData({{"id", 123}});
suggestBox->addSuggestion(data);

// 建议点击响应
QObject::connect(suggestBox, &ElaSuggestBox::suggestionClicked,
    [](const ElaSuggestBox::SuggestData& data) {
        qDebug() << "Selected:" << data.getSuggestText();
    });
```

### 2.7 ElaTabWidget

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaTabWidget.h` |
| **功能简介** | 现代风格的标签页容器，支持拖拽重新排序 |
| **继承关系** | `QTabWidget` |
| **关键 API** | `setTabPosition(TabPosition)` — 标签位置（North/South...）<br>`setTabSize(QSize)` — 标签大小<br>`addTab(widget, title)` — 从父类继承的 addTab |

```cpp
#include "ElaTabWidget.h"
#include "ElaText.h"

ElaTabWidget* tabWidget = new ElaTabWidget(parent);
tabWidget->setTabPosition(QTabWidget::North);
tabWidget->setTabSize(QSize(160, 36));
tabWidget->setIsTabTransparent(false);

// 添加标签页
tabWidget->addTab(new ElaText("页面一内容"), "页面一");
tabWidget->addTab(new ElaText("页面二内容"), "页面二");

// 标签切换响应
QObject::connect(tabWidget, &QTabWidget::currentChanged, [](int index) {
    qDebug() << "当前标签:" << index;
});
```

---

## 三、按钮组件

### 3.1 ElaPushButton

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaPushButton.h` |
| **功能简介** | 现代风格按钮，支持圆角、主题色 |
| **继承关系** | `QPushButton` |
| **关键 API** | `setText(text)` — 继承自 QPushButton<br>`setBorderRadius(int)` — 圆角大小<br>`setLightDefaultColor/ setDarkDefaultColor/ setLightHoverColor/ setDarkPressColor(...)` — 自定义颜色<br>`setLightTextColor/ setDarkTextColor(QColor)` — 文字颜色 |

```cpp
#include "ElaPushButton.h"
#include <QHBoxLayout>

auto* btn = new ElaPushButton("点击我");
btn->setBorderRadius(6);
btn->setFixedSize(120, 36);

// 自定义主题色
btn->setLightDefaultColor(QColor(0, 120, 212));
btn->setDarkDefaultColor(QColor(60, 160, 255));

QObject::connect(btn, &ElaPushButton::clicked, []() {
    qDebug() << "按钮被点击!";
});
```

### 3.2 ElaIconButton

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaIconButton.h` |
| **功能简介** | 纯图标按钮，支持 Font Awesome 图标 |
| **继承关系** | `QPushButton` |
| **关键 API** | `ElaIconButton(ElaIconType::IconName, pixelSize, parent)` — 构造<br>`setAwesome(iconName)` — 更换图标<br>`setBorderRadius(int)` — 圆角<br>`setIsSelected(bool)` — 选中状态<br>`setLightIconColor/ setDarkIconColor(...)` — 图标颜色 |

```cpp
#include "ElaIconButton.h"
#include "ElaIcon.h"

// 创建 24px 大小的齿轮图标按钮
auto* iconBtn = new ElaIconButton(ElaIconType::Gear, 24, parent);
iconBtn->setBorderRadius(8);
iconBtn->setFixedSize(40, 40);
iconBtn->setLightIconColor(QColor(30, 30, 30));

// 切换图标
iconBtn->setAwesome(ElaIconType::Star);

// 选中高亮
iconBtn->setIsSelected(true);
```

### 3.3 ElaToggleButton

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaToggleButton.h` |
| **功能简介** | 可保持按下状态的切换按钮 |
| **继承关系** | `QWidget`（注意：不是 QPushButton，但有类似外观） |
| **关键 API** | `setIsToggled(bool)` — 设置切换状态<br>`getIsToggled()` — 获取状态<br>`setText(text)` — 按钮文字 |

```cpp
#include "ElaToggleButton.h"

auto* toggleBtn = new ElaToggleButton("锁定", parent);
toggleBtn->setBorderRadius(6);
toggleBtn->setFixedSize(100, 36);

QObject::connect(toggleBtn, &ElaToggleButton::toggled, [](bool checked) {
    qDebug() << "切换状态:" << (checked ? "开" : "关");
});

// 代码触发切换
toggleBtn->setIsToggled(true);
```

### 3.4 ElaToolButton

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaToolButton.h` |
| **功能简介** | 工具栏按钮，支持图标+弹出菜单 |
| **继承关系** | `QToolButton` |
| **关键 API** | `setElaIcon(iconName)` — 设置图标<br>`setElaIcon(iconName, rotate)` — 设置图标并旋转<br>`setMenu(ElaMenu*)` — 关联弹出菜单<br>`setIsTransparent(bool)` — 透明背景 |

```cpp
#include "ElaToolButton.h"
#include "ElaMenu.h"
#include "ElaIcon.h"

auto* toolBtn = new ElaToolButton(parent);
toolBtn->setElaIcon(ElaIconType::Plus);
toolBtn->setIsTransparent(true);

// 关联弹出菜单
ElaMenu* menu = new ElaMenu();
menu->addElaIconAction(ElaIconType::File, "新建文件");
menu->addElaIconAction(ElaIconType::Folder, "新建文件夹");
toolBtn->setMenu(menu);
```

### 3.5 ElaMessageButton

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaMessageButton.h` |
| **功能简介** | 点击后弹出 ElaMessageBar 消息条的便捷按钮 |
| **继承关系** | `QPushButton` |
| **关键 API** | `setBarTitle(text)` — 消息标题<br>`setBarText(text)` — 消息正文<br>`setMessageMode(mode)` — Success/Warning/Information/Error<br>`setPositionPolicy(policy)` — 消息显示位置<br>`setDisplayMsec(ms)` — 显示时长 |

```cpp
#include "ElaMessageButton.h"

auto* msgBtn = new ElaMessageButton("显示消息", parent);
msgBtn->setBarTitle("保存成功");
msgBtn->setBarText("文件已保存到磁盘");
msgBtn->setMessageMode(ElaMessageBarType::Success);
msgBtn->setPositionPolicy(ElaMessageBarType::TopRight);
msgBtn->setDisplayMsec(3000);
```

---

## 四、输入组件

### 4.1 ElaLineEdit

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaLineEdit.h` |
| **功能简介** | 圆角单行输入框，带清除按钮，支持聚焦信号 |
| **继承关系** | `QLineEdit` |
| **关键 API** | `setBorderRadius(int)` — 圆角<br>`setIsClearButtonEnable(bool)` — 显示清除按钮<br>`focusIn(QString text)` — 聚焦信号<br>`focusOut(QString text)` — 失焦信号 |

```cpp
#include "ElaLineEdit.h"

auto* edit = new ElaLineEdit(parent);
edit->setPlaceholderText("请输入搜索内容...");
edit->setBorderRadius(8);
edit->setIsClearButtonEnable(true);
edit->setFixedHeight(36);

QObject::connect(edit, &ElaLineEdit::focusIn, [](QString text) {
    qDebug() << "输入框获得焦点，当前内容:" << text;
});
QObject::connect(edit, &QLineEdit::returnPressed, [edit]() {
    qDebug() << "搜索:" << edit->text();
});
```

### 4.2 ElaPlainTextEdit

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaPlainTextEdit.h` |
| **功能简介** | 多行纯文本编辑器，支持聚焦信号 |
| **继承关系** | `QPlainTextEdit` |
| **关键 API** | 继承自 QPlainTextEdit

```cpp
#include "ElaPlainTextEdit.h"

auto* textEdit = new ElaPlainTextEdit(parent);
textEdit->setPlainText("请输入内容...");
textEdit->setFixedHeight(200);
```

### 4.3 ElaSpinBox / ElaDoubleSpinBox

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaSpinBox.h` / `ElaDoubleSpinBox.h` |
| **功能简介** | 数字输入框，支持 Inline/Compact/Side/PMSide 四种按钮模式 |
| **继承关系** | `QSpinBox` / `QDoubleSpinBox` |
| **关键 API** | `setButtonMode(ElaSpinBoxType::ButtonMode)` — 按钮模式 |

```cpp
#include "ElaSpinBox.h"
#include "ElaDoubleSpinBox.h"

auto* spinBox = new ElaSpinBox(parent);
spinBox->setRange(0, 100);
spinBox->setValue(50);
spinBox->setButtonMode(ElaSpinBoxType::Inline);

auto* doubleSpin = new ElaDoubleSpinBox(parent);
doubleSpin->setRange(0.0, 1.0);
doubleSpin->setSingleStep(0.1);
doubleSpin->setDecimals(2);
doubleSpin->setButtonMode(ElaSpinBoxType::Compact);
```

### 4.4 ElaComboBox

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaComboBox.h` |
| **功能简介** | 现代风格下拉框，支持圆角 |
| **继承关系** | `QComboBox` |
| **关键 API** | `setBorderRadius(int)` — 圆角<br>`setEditable(bool)` — 可编辑<br>`addItem(text)` — 继承自 QComboBox<br>`setEditable(bool)` — 设置可编辑<br>`currentIndexChanged(int)` — 信号（继承） |

```cpp
#include "ElaComboBox.h"

auto* combo = new ElaComboBox(parent);
combo->setBorderRadius(6);
combo->setFixedHeight(36);
combo->addItem("选项 A");
combo->addItem("选项 B");
combo->addItem("选项 C");

QObject::connect(combo, &ElaComboBox::currentIndexChanged, [](int index) {
    qDebug() << "选中索引:" << index;
});
```

### 4.5 ElaMultiSelectComboBox

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaMultiSelectComboBox.h` |
| **功能简介** | 多选下拉框，支持勾选多个选项 |
| **继承关系** | `QComboBox` |
| **关键 API** | `setCurrentSelection(QStringList)` — 设置选中项<br>`getCurrentSelection()` — 获取选中文字列表<br>`getCurrentSelectionIndex()` — 获取选中索引列表<br>`currentTextListChanged(list)` — 选中项变化信号 |

```cpp
#include "ElaMultiSelectComboBox.h"

auto* multiCombo = new ElaMultiSelectComboBox(parent);
multiCombo->setBorderRadius(6);
multiCombo->setFixedHeight(36);
multiCombo->addItem("C++");
multiCombo->addItem("Python");
multiCombo->addItem("Java");
multiCombo->addItem("Rust");

// 设置默认选中
multiCombo->setCurrentSelection({"C++", "Rust"});

QObject::connect(multiCombo, &ElaMultiSelectComboBox::currentTextListChanged,
    [](QStringList selected) {
        qDebug() << "选中了:" << selected;
    });
```

### 4.6 ElaSlider

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaSlider.h` |
| **功能简介** | 现代风格滑块条，支持水平和垂直方向 |
| **继承关系** | `QSlider` |
| **关键 API** | 继承自 QSlider的全部 API

```cpp
#include "ElaSlider.h"
#include <QHBoxLayout>

auto* slider = new ElaSlider(Qt::Horizontal, parent);
slider->setRange(0, 100);
slider->setValue(50);
slider->setFixedHeight(30);

QObject::connect(slider, &ElaSlider::valueChanged, [](int value) {
    qDebug() << "滑块值:" << value;
});
```

### 4.7 ElaProgressBar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaProgressBar.h` |
| **功能简介** | 现代风格进度条 |
| **继承关系** | `QProgressBar` |
| **关键 API** | `setMinimum/minimum` — 最小值<br>`setMaximum/maximum` — 最大值<br>`setValue/value` — 当前值 |

```cpp
#include "ElaProgressBar.h"

auto* progressBar = new ElaProgressBar(parent);
progressBar->setRange(0, 100);
progressBar->setValue(50);
progressBar->setFixedHeight(6);

// 模拟进度更新
QTimer* timer = new QTimer();
QObject::connect(timer, &QTimer::timeout, [progressBar]() {
    int val = progressBar->value() + 5;
    if (val > 100) val = 0;
    progressBar->setValue(val);
});
timer->start(200);
```

### 4.8 ElaProgressRing

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaProgressRing.h` |
| **功能简介** | 环形进度指示器，支持忙碌模式、百分比/实际值显示 |
| **继承关系** | `QWidget` |
| **关键 API** | `setRange(min, max)` — 设置范围<br>`setValue(int)` — 当前值<br>`setMinimum/maximum` — 范围<br>`setIsBusying(bool)` — 忙碌旋转模式<br>`setIsDisplayValue(bool)` — 显示数值<br>`setValueDisplayMode(Actual/Percent)` — 显示模式 |

```cpp
#include "ElaProgressRing.h"

// 确定进度模式
auto* ring = new ElaProgressRing(parent);
ring->setRange(0, 100);
ring->setValue(65);
ring->setFixedSize(80, 80);
ring->setIsDisplayValue(true);
ring->setValueDisplayMode(ElaProgressRingType::Percent);

// 忙碌旋转模式
auto* busyRing = new ElaProgressRing(parent);
busyRing->setIsBusying(true);
busyRing->setFixedSize(40, 40);
busyRing->setBusyingWidth(4);
```

### 4.9 ElaLCDNumber

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaLCDNumber.h` |
| **功能简介** | 电子表风格数字显示，支持自动时钟 |
| **继承关系** | `QLCDNumber` |
| **关键 API** | `setIsUseAutoClock(bool)` — 启用自动时钟<br>`setAutoClockFormat(fmt)` — 时间格式（如 "hh:mm:ss"） |

```cpp
#include "ElaLCDNumber.h"

auto* lcd = new ElaLCDNumber(parent);
lcd->setDigitCount(8);
lcd->setIsUseAutoClock(true);
lcd->setAutoClockFormat("hh:mm:ss");
lcd->setFixedHeight(60);
```

---

## 五、选择组件

### 5.1 ElaCheckBox

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaCheckBox.h` |
| **功能简介** | 现代风格复选框 |
| **继承关系** | `QCheckBox` |
| **关键 API** | 继承自 QCheckBox

```cpp
#include "ElaCheckBox.h"

auto* checkBox = new ElaCheckBox("记住密码", parent);
checkBox->setBorderRadius(4);

QObject::connect(checkBox, &ElaCheckBox::stateChanged, [](int state) {
    if (state == Qt::Checked) {
        qDebug() << "已勾选";
    }
});
```

### 5.2 ElaRadioButton

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaRadioButton.h` |
| **功能简介** | 现代风格单选按钮 |
| **继承关系** | `QRadioButton` |
| **关键 API** | 继承自 QRadioButton

```cpp
#include "ElaRadioButton.h"
#include <QButtonGroup>
#include <QVBoxLayout>

auto* group = new QButtonGroup(parent);
auto* radio1 = new ElaRadioButton("选项一");
auto* radio2 = new ElaRadioButton("选项二");
auto* radio3 = new ElaRadioButton("选项三");

group->addButton(radio1, 0);
group->addButton(radio2, 1);
group->addButton(radio3, 2);

QObject::connect(group, &QButtonGroup::idClicked, [](int id) {
    qDebug() << "选中了:" << id;
});
```

### 5.3 ElaToggleSwitch

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaToggleSwitch.h` |
| **功能简介** | Win11 风格开关控件 |
| **继承关系** | `QWidget` |
| **关键 API** | `setIsToggled(bool)` — 开关状态<br>`getIsToggled()` — 获取状态<br>`toggled(bool)` — 状态变化信号 |

```cpp
#include "ElaToggleSwitch.h"

auto* toggleSwitch = new ElaToggleSwitch(parent);
toggleSwitch->setIsToggled(false);

QObject::connect(toggleSwitch, &ElaToggleSwitch::toggled, [](bool checked) {
    qDebug() << "WiFi 状态:" << (checked ? "开" : "关");
});
```

### 5.4 ElaCalendar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaCalendar.h` |
| **功能简介** | 日历组件，支持日期选择和范围限制 |
| **继承关系** | `QWidget` |
| **关键 API** | `setSelectedDate(QDate)` — 选中日期<br>`setMinimumDate/maximumDate` — 日期范围<br>`clicked(QDate)` — 日期点击信号 |

```cpp
#include "ElaCalendar.h"

auto* calendar = new ElaCalendar(parent);
calendar->setMinimumDate(QDate::currentDate().addDays(-30));
calendar->setMaximumDate(QDate::currentDate().addDays(30));
calendar->setSelectedDate(QDate::currentDate());

QObject::connect(calendar, &ElaCalendar::clicked, [](QDate date) {
    qDebug() << "选中日期:" << date.toString("yyyy-MM-dd");
});
```

### 5.5 ElaCalendarPicker

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaCalendarPicker.h` |
| **功能简介** | 日历选择按钮，点击弹出日历菜单供选择日期 |
| **继承关系** | `QPushButton` |
| **关键 API** | `setSelectedDate(QDate)` — 设置日期<br>`getSelectedDate()` — 获取日期<br>`selectedDateChanged(QDate)` — 日期变化信号 |

```cpp
#include "ElaCalendarPicker.h"

auto* picker = new ElaCalendarPicker(parent);
picker->setFixedHeight(36);
picker->setBorderRadius(6);
picker->setText("选择日期");

QObject::connect(picker, &ElaCalendarPicker::selectedDateChanged, [](QDate date) {
    qDebug() << "选择日期:" << date.toString("yyyy-MM-dd");
});
```

### 5.6 ElaRoller

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaRoller.h` |
| **功能简介** | 滚轮选择器（单列），类似 iOS 滚轮 |
| **继承关系** | `QWidget` |
| **关键 API** | `setItemList(QStringList)` — 设置选项列表<br>`setCurrentIndex(int)` — 当前选中索引<br>`setCurrentData(text)` — 选中指定文本<br>`getCurrentData()` — 获取当前文本<br>`setItemHeight(int)` — 项高度<br>`setMaxVisibleItems(int)` — 可见项数<br>`setIsEnableLoop(bool)` — 循环滚动<br>`currentDataChanged(text)` — 数据变化信号 |

```cpp
#include "ElaRoller.h"

auto* roller = new ElaRoller(parent);
roller->setItemList({"苹果", "香蕉", "橙子", "葡萄", "西瓜"});
roller->setCurrentIndex(2);  // 默认选中"橙子"
roller->setItemHeight(40);
roller->setMaxVisibleItems(5);
roller->setIsEnableLoop(true);
roller->setFixedSize(200, 200);

QObject::connect(roller, &ElaRoller::currentDataChanged, [](const QString& data) {
    qDebug() << "选择了:" << data;
});
```

### 5.7 ElaRollerPicker

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaRollerPicker.h` |
| **功能简介** | 滚轮选择器按钮（多列），点击弹出多列滚轮选择弹窗 |
| **继承关系** | `QPushButton` |
| **关键 API** | `addRoller(itemList, isEnableLoop)` — 添加一列滚轮<br>`setCurrentData(index, data)` — 设置某列选中值<br>`getCurrentData()` — 获取所有列数据<br>`currentDataChanged(list)` — 数据变化信号<br>`currentDataSelectionChanged(list)` — 选中确认信号 |

```cpp
#include "ElaRollerPicker.h"

auto* rollerPicker = new ElaRollerPicker(parent);
rollerPicker->setFixedHeight(36);
rollerPicker->setBorderRadius(6);

// 添加三列滚轮：年月日
rollerPicker->addRoller({"2024", "2025", "2026"});
rollerPicker->addRoller({"1月", "2月", "3月", "4月", "5月", "6月",
                         "7月", "8月", "9月", "10月", "11月", "12月"});
rollerPicker->addRoller({"1日", "2日", "3日", "4日", "5日"});

QObject::connect(rollerPicker, &ElaRollerPicker::currentDataSelectionChanged,
    [](const QStringList& dataList) {
        qDebug() << "选中:" << dataList.join(" ");
    });
```

### 5.8 ElaColorDialog

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaColorDialog.h` |
| **功能简介** | 颜色选择对话框，支持自定义颜色列表 |
| **继承关系** | `QDialog` |
| **关键 API** | `setCurrentColor(QColor)` — 设置初始颜色<br>`getCurrentColor()` — 获取当前颜色<br>`getCurrentColorRGB()` — 获取 RGB 字符串<br>`colorSelected(QColor)` — 颜色选中信号 |

```cpp
#include "ElaColorDialog.h"

ElaColorDialog* colorDlg = new ElaColorDialog(parent);
colorDlg->setCurrentColor(QColor(0, 120, 212));

QObject::connect(colorDlg, &ElaColorDialog::colorSelected, [](const QColor& color) {
    qDebug() << "选中颜色:" << color.name();
});

colorDlg->exec();
```

---

## 六、显示组件

### 6.1 ElaText

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaText.h` |
| **功能简介** | 带样式的文字标签，支持 Caption/Body/Subtitle/Title/Display 等预设样式 |
| **继承关系** | `QLabel` |
| **关键 API** | `setTextStyle(ElaTextType::TextStyle)` — Caption/Body/Subtitle/Title 等<br>`setTextPixelSize(int)` — 像素大小<br>`setTextPointSize(int)` — 点大小<br>`setIsWrapAnywhere(bool)` — 任意换行<br>`setElaIcon(ElaIconType::IconName)` — 图标 |

```cpp
#include "ElaText.h"
#include <QVBoxLayout>

auto* display = new ElaText("展示文本", ElaTextType::Display);
auto* title = new ElaText("标题文本", ElaTextType::Title);
auto* subtitle = new ElaText("副标题文本", ElaTextType::Subtitle);
auto* body = new ElaText("正文文本");

display->setTextPixelSize(48);

// 图标文字
auto* iconText = new ElaText("设置");
iconText->setElaIcon(ElaIconType::Gear);
```

### 6.2 ElaIcon

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaIcon.h` |
| **功能简介** | Font Awesome 图标引擎单例，生成带图标的 QIcon |
| **继承关系** | —（静态工具类） |
| **关键 API** | `getElaIcon(IconName)` — 获取图标<br>`getElaIcon(IconName, color)` — 指定颜色<br>`getElaIcon(IconName, pixelSize, color)` — 指定大小和颜色<br>`getElaIcon(IconName, pixelSize, width, height, color)` — 完全控制 |

```cpp
#include "ElaIcon.h"

// 获取一个 32px 的蓝色齿轮图标
QIcon gearIcon = ElaIcon::getInstance()->getElaIcon(
    ElaIconType::Gear, 32, QColor(0, 120, 212));

// 直接用于按钮
auto* btn = new QPushButton(gearIcon, "设置");
```

### 6.3 ElaStatusBar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaStatusBar.h` |
| **功能简介** | 现代风格状态栏 |
| **继承关系** | `QStatusBar` |

```cpp
#include "ElaStatusBar.h"

ElaStatusBar* statusBar = new ElaStatusBar(parent);
statusBar->showMessage("就绪");
```

### 6.4 ElaScrollArea

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaScrollArea.h` |
| **功能简介** | 带手势拖拽和弹性效果的滚动区域 |
| **继承关系** | `QScrollArea` |
| **关键 API** | `setIsGrabGesture(bool, delay)` — 启用拖拽手势<br>`setIsOverShoot(orientation, bool)` — 弹性效果<br>`setIsAnimation(orientation, bool)` — 动画滚动 |

```cpp
#include "ElaScrollArea.h"

ElaScrollArea* scrollArea = new ElaScrollArea(parent);
scrollArea->setIsGrabGesture(true, 0.3);
scrollArea->setIsOverShoot(Qt::Vertical, true);
scrollArea->setIsAnimation(Qt::Vertical, true);

auto* content = new QWidget();
content->setFixedSize(400, 1200);
scrollArea->setWidget(content);
```

### 6.5 ElaScrollBar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaScrollBar.h` |
| **功能简介** | 现代风格滚动条，带动画和速度限制 |
| **继承关系** | `QScrollBar` |
| **关键 API** | `setIsAnimation(bool)` — 动画滚动<br>`setSpeedLimit(qreal)` — 速度限制<br>`rangeAnimationFinished()` — 动画结束信号 |

```cpp
#include "ElaScrollBar.h"
#include <QTextEdit>

ElaScrollBar* scrollBar = new ElaScrollBar(Qt::Vertical, parent);
scrollBar->setIsAnimation(true);
scrollBar->setSpeedLimit(0.5);

// 替换 QTextEdit 的滚动条
QTextEdit* editor = new QTextEdit(parent);
editor->setVerticalScrollBar(scrollBar);
```

---

## 七、布局组件

### 7.1 ElaFlowLayout

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaFlowLayout.h` |
| **功能简介** | 流式布局，子组件自动换行排列，支持动画 |
| **继承关系** | `QLayout` |
| **关键 API** | `addItem(widget)` — 添加组件<br>`setIsAnimation(bool)` — 布局变化动画<br>`horizontalSpacing/verticalSpacing` — 间距 |

```cpp
#include "ElaFlowLayout.h"
#include "ElaPushButton.h"
#include <QWidget>

QWidget* container = new QWidget();
ElaFlowLayout* flow = new ElaFlowLayout(container, 10, 8, 8);
flow->setIsAnimation(true);

// 添加多个按钮，自动换行排列
for (int i = 0; i < 20; i++) {
    auto* btn = new ElaPushButton(QString("按钮 %1").arg(i + 1));
    btn->setBorderRadius(6);
    flow->addWidget(btn);
}
```

### 7.2 ElaDrawerArea

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaDrawerArea.h` |
| **功能简介** | 抽屉式侧边面板，可展开/折叠，带标题头 |
| **继承关系** | `QWidget` |
| **关键 API** | `setDrawerHeader(QWidget*)` — 设置头部组件<br>`addDrawer(widget)` / `removeDrawer(widget)` — 添加/移除抽屉内容<br>`expand()` / `collapse()` — 展开/折叠<br>`getIsExpand()` — 当前状态<br>`expandStateChanged(bool)` — 状态变化信号 |

```cpp
#include "ElaDrawerArea.h"
#include "ElaText.h"
#include "ElaPushButton.h"
#include <QVBoxLayout>

ElaDrawerArea* drawer = new ElaDrawerArea(parent);
drawer->setFixedWidth(300);
drawer->setBorderRadius(8);

// 设置头部
auto* header = new QWidget();
auto* headerLayout = new QHBoxLayout(header);
headerLayout->addWidget(new ElaText("筛选条件"));
drawer->setDrawerHeader(header);

// 添加内容
auto* content = new QWidget();
auto* contentLayout = new QVBoxLayout(content);
contentLayout->addWidget(new ElaCheckBox("选项 A"));
contentLayout->addWidget(new ElaCheckBox("选项 B"));
contentLayout->addWidget(new ElaCheckBox("选项 C"));
drawer->addDrawer(content);

// 展开/折叠控制
drawer->expand();
// drawer->collapse();
```

---

## 八、对话框与消息

### 8.1 ElaMessageBar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaMessageBar.h` |
| **功能简介** | 静态消息条，在屏幕指定位置弹出成功/警告/信息/错误提示 |
| **继承关系** | `QWidget` |
| **关键 API** | `static success(policy, title, text, ms, parent)` — 成功消息<br>`static warning(...)` — 警告消息<br>`static information(...)` — 信息消息<br>`static error(...)` — 错误消息 |

```cpp
#include "ElaMessageBar.h"

// 在窗口右上角显示成功消息
ElaMessageBar::success(
    ElaMessageBarType::TopRight,
    "操作成功",
    "文件已成功导出到桌面。",
    3000,    // 显示 3 秒
    this     // 父窗口
);

// 其他类型
ElaMessageBar::warning(
    ElaMessageBarType::Top, "警告", "电量不足", 5000, this);

ElaMessageBar::information(
    ElaMessageBarType::BottomRight, "提示", "有新版本可用", 4000, this);

ElaMessageBar::error(
    ElaMessageBarType::TopRight, "错误", "网络连接失败", 5000, this);

// 位置策略:
//   Top, Left, Bottom, Right,
//   TopRight, TopLeft, BottomRight, BottomLeft
```

### 8.2 ElaContentDialog

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaContentDialog.h` |
| **功能简介** | 内容对话框，带左/中/右三个按钮，可嵌入自定义中央组件 |
| **继承关系** | `QDialog` |
| **关键 API** | `setLeftButtonText(text)` — 设置左按钮文字<br>`setMiddleButtonText(text)` — 设置中按钮文字<br>`setRightButtonText(text)` — 设置右按钮文字<br>`setCentralWidget(widget)` — 设置中央内容区域<br>`leftButtonClicked()` / `middleButtonClicked()` / `rightButtonClicked()` — 按钮点击信号<br>`onLeftButtonClicked()` — 虚函数，可重写 |

```cpp
#include "ElaContentDialog.h"
#include "ElaText.h"
#include <QVBoxLayout>

ElaContentDialog* dialog = new ElaContentDialog(this);
dialog->setCentralWidget(new ElaText("确认要删除此文件吗？", this));
dialog->setLeftButtonText("取消");
dialog->setMiddleButtonText("更多信息");
dialog->setRightButtonText("确认删除");

QObject::connect(dialog, &ElaContentDialog::leftButtonClicked, dialog, &ElaContentDialog::close);
QObject::connect(dialog, &ElaContentDialog::rightButtonClicked, [dialog]() {
    qDebug() << "用户确认删除";
    dialog->close();
});

dialog->exec();
```

### 8.3 ElaColorDialog

已在 [5.8 ElaColorDialog](#58-elacolordialog) 中说明。

### 8.4 ElaToolTip

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaToolTip.h` |
| **功能简介** | 自定义提示气泡，可显示文本或嵌入自定义组件 |
| **继承关系** | `QWidget` |
| **关键 API** | `setToolTip(text)` — 设置提示文本<br>`setCustomWidget(widget)` — 设置自定义提示内容<br>`setDisplayMsec(ms)` — 显示时长<br>`setShowDelayMsec(ms)` / `setHideDelayMsec(ms)` — 显示/隐藏延迟<br>`updatePos()` — 更新位置 |

```cpp
#include "ElaToolTip.h"

auto* toolTip = new ElaToolTip(button);
toolTip->setToolTip("这是一个提示气泡");
toolTip->setDisplayMsec(5000);
toolTip->setShowDelayMsec(500);

// 或设置自定义组件
auto* customTip = new ElaToolTip(button);
auto* tipContent = new QWidget();
auto* layout = new QVBoxLayout(tipContent);
layout->addWidget(new ElaText("自定义提示", ElaTextType::Subtitle));
layout->addWidget(new ElaText("详细说明..."));
customTip->setCustomWidget(tipContent);
```

---

## 九、事件系统

### 9.1 ElaEventBus / ElaEvent

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaEventBus.h` |
| **功能简介** | 全局事件总线，解耦组件通信。通过事件名+函数名的字符串匹配分发 |
| **继承关系** | `QObject`（单例） |
| **关键 API** | `ElaEvent(name, funcName, parent)` — 创建事件对象并注册<br>`post(eventName, data)` — 发布事件<br>`getRegisteredEventsName()` — 获取已注册事件列表 |

**步骤 1：在某对象中监听事件**

```cpp
#include "ElaEventBus.h"

class MyListener : public QWidget
{
    Q_OBJECT
public:
    MyListener(QWidget* parent = nullptr) : QWidget(parent) {
        // 注册监听：当事件 "ThemeChanged" 被发布时，调用本对象的 onThemeChanged 槽
        auto* event = new ElaEvent("ThemeChanged", "onThemeChanged", this);
        event->registerAndInit();
    }

public Q_SLOTS:
    void onThemeChanged(const QVariantMap& data) {
        QString theme = data.value("theme").toString();
        qDebug() << "主题变更为:" << theme;
    }
};
```

**步骤 2：在任意位置发布事件**

```cpp
#include "ElaEventBus.h"

// 发布事件，携带数据
ElaEventBus::getInstance()->post("ThemeChanged", {
    {"theme", "dark"},
    {"accentColor", "#0078D4"}
});
```

**完整示例：**

```cpp
// === WidgetA.h ===
class WidgetA : public QWidget
{
    Q_OBJECT
public:
    WidgetA(QWidget* parent = nullptr);
};

// === WidgetA.cpp ===
WidgetA::WidgetA(QWidget* parent) : QWidget(parent)
{
    auto* event = new ElaEvent("DataUpdated", "onDataUpdated", this);
    event->registerAndInit();
}

void onDataUpdated(const QVariantMap& data)  // 需声明为 Q_SLOT
{
    qDebug() << "收到数据更新:" << data;
    // WidgetA 的 Q_SLOT 声明在头文件的 Q_SLOTS 区域
}

// === WidgetB.cpp（发布者）===
ElaEventBus::getInstance()->post("DataUpdated", {
    {"id", 42},
    {"name", "张三"},
    {"score", 98.5}
});
```

### 9.2 ElaActionCommander

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaActionCommander.h` |
| **功能简介** | 撤销/重做命令管理器，按领域记录命令 |
| **继承关系** | `QObject`（单例） |
| **关键 API** | `recordCommand(domain, command, isRedo)` — 记录命令<br>`undoCommand(domain)` — 撤销<br>`redoCommand(domain)` — 重做<br>`clearCommand(domain)` — 清除命令<br>`getCommanderUndoState/RedoState(domain)` — 查询状态 |

```cpp
#include "ElaActionCommander.h"

// 自定义命令
class MoveCommand : public ElaActionCommand
{
public:
    MoveCommand(QPoint oldPos, QPoint newPos)
        : m_oldPos(oldPos), m_newPos(newPos) {}

    void undo() override {
        // target->move(m_oldPos);
        qDebug() << "撤销移动，回到" << m_oldPos;
    }

    void redo() override {
        // target->move(m_newPos);
        qDebug() << "重做移动至" << m_newPos;
    }

private:
    QPoint m_oldPos, m_newPos;
};

// 使用
ElaActionCommander* commander = ElaActionCommander::getInstance();
commander->recordCommand("canvas", new MoveCommand(QPoint(0,0), QPoint(100,100)));

// 撤销
commander->undoCommand("canvas");
// 重做
commander->redoCommand("canvas");

// 监听状态变化
QObject::connect(commander, &ElaActionCommander::commanderStateChanged,
    [](const QString& domain, ElaActionCommanderType::CommanderState state) {
        qDebug() << domain << "状态:" << state;
    });
```

---

## 十、菜单与工具栏

### 10.1 ElaMenu

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaMenu.h` |
| **功能简介** | 现代风格弹出菜单，支持 Font Awesome 图标菜单项 |
| **继承关系** | `QMenu` |
| **关键 API** | `addMenu(title)` — 添加子菜单<br>`addMenu(icon, title)` — 带图标的子菜单<br>`addMenu(ElaIconType::IconName, title)` — 用 ElaIconType 创建子菜单<br>`addElaIconAction(icon, text)` — 添加带图标的动作<br>`addElaIconAction(icon, text, shortcut)` — 带快捷键的动作<br>`setMenuItemHeight(int)` — 设置菜单项高度 |

```cpp
#include "ElaMenu.h"
#include "ElaIcon.h"

// 创建菜单
ElaMenu* menu = new ElaMenu("文件", parent);

// 添加带图标的菜单项
menu->addElaIconAction(ElaIconType::File, "新建文件", QKeySequence::New);
menu->addElaIconAction(ElaIconType::FolderOpen, "打开", QKeySequence::Open);
menu->addSeparator();
menu->addElaIconAction(ElaIconType::FloppyDisk, "保存", QKeySequence::Save);

// 添加子菜单
ElaMenu* subMenu = menu->addMenu(ElaIconType::Gear, "选项");
subMenu->addElaIconAction(ElaIconType::User, "用户设置");
subMenu->addElaIconAction(ElaIconType::Palette, "外观");

// 设置菜单项高度
menu->setMenuItemHeight(36);

// 在按钮上弹出菜单
auto* btn = new ElaPushButton("菜单");
btn->setMenu(menu);
```

### 10.2 ElaMenuBar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaMenuBar.h` |
| **功能简介** | 现代风格菜单栏 |
| **继承关系** | `QMenuBar` |
| **关键 API** | `addMenu(title)` — 添加菜单<br>`addMenu(icon, title)` / `addMenu(ElaIconType::IconName, title)` — 带图标菜单<br>`addElaIconAction(icon, text)` — 添加动作 |

```cpp
#include "ElaMenuBar.h"

ElaMenuBar* menuBar = new ElaMenuBar(parent);

// 添加带图标的菜单
ElaMenu* fileMenu = menuBar->addMenu(ElaIconType::File, "文件");
fileMenu->addElaIconAction(ElaIconType::FolderOpen, "打开...");

ElaMenu* editMenu = menuBar->addMenu(ElaIconType::Pencil, "编辑");
editMenu->addElaIconAction(ElaIconType::ArrowRotateLeft, "撤销");
editMenu->addElaIconAction(ElaIconType::ArrowRotateRight, "重做");
```

### 10.3 ElaToolBar

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaToolBar.h` |
| **功能简介** | 现代风格工具栏 |
| **继承关系** | `QToolBar` |
| **关键 API** | `addElaIconAction(icon, text)` — 添加图标动作<br>`addElaIconAction(icon, text, shortcut)` — 带快捷键<br>`setToolBarSpacing(int)` — 间距<br>`setToolButtonSize(QSize)` — 按钮大小 |

```cpp
#include "ElaToolBar.h"
#include "ElaIcon.h"

ElaToolBar* toolBar = new ElaToolBar("工具栏", parent);
toolBar->setToolButtonSize(QSize(40, 40));
toolBar->setToolBarSpacing(4);

toolBar->addElaIconAction(ElaIconType::File, "新建", QKeySequence::New);
toolBar->addElaIconAction(ElaIconType::FolderOpen, "打开", QKeySequence::Open);
toolBar->addSeparator();
toolBar->addElaIconAction(ElaIconType::FloppyDisk, "保存", QKeySequence::Save);

// 为动作添加响应
QAction* newAction = toolBar->actions().first();
QObject::connect(newAction, &QAction::triggered, []() {
    qDebug() << "新建文件";
});
```

---

## 十一、卡片组件

### 11.1 ElaInteractiveCard

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaInteractiveCard.h` |
| **功能简介** | 交互式卡片按钮，带标题、副标题、图片 |
| **继承关系** | `QPushButton` |
| **关键 API** | `setTitle/SubTitle(text)` — 标题<br>`setTitlePixelSize/SubTitlePixelSize(int)` — 字号<br>`setCardPixmap(QPixmap)` — 设置图片<br>`setCardPixmapSize(w, h)` — 图片尺寸<br>`setCardPixmapMode(PixMode)` — Default/RoundedRect/Ellipse |

```cpp
#include "ElaInteractiveCard.h"

auto* card = new ElaInteractiveCard(parent);
card->setTitle("项目名称");
card->setSubTitle("项目描述信息");
card->setCardPixmap(QPixmap(":/images/icon.png"));
card->setCardPixmapSize(48, 48);
card->setCardPixmapBorderRadius(8);
card->setCardPixmapMode(ElaCardPixType::RoundedRect);
card->setBorderRadius(8);
card->setFixedSize(280, 100);

QObject::connect(card, &ElaInteractiveCard::clicked, []() {
    qDebug() << "卡片被点击";
});
```

### 11.2 ElaPopularCard

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaPopularCard.h` |
| **功能简介** | 热门卡片组件，带大图、标题、描述、按钮和浮动区域 |
| **继承关系** | `QWidget` |
| **关键 API** | `setTitle/SubTitle/DetailedText` — 文字内容<br>`setCardPixmap(QPixmap)` — 主图<br>`setCardButtonText(text)` — 按钮文字<br>`setInteractiveTips(text)` — 交互提示<br>`popularCardClicked()` — 点击信号<br>`popularCardButtonClicked()` — 按钮点击信号 |

```cpp
#include "ElaPopularCard.h"

auto* popularCard = new ElaPopularCard(parent);
popularCard->setTitle("热门推荐");
popularCard->setSubTitle("限时优惠");
popularCard->setDetailedText("这是一款非常受欢迎的产品，现在购买享受优惠价格。");
popularCard->setCardPixmap(QPixmap(":/images/product.jpg"));
popularCard->setCardButtonText("立即购买");
popularCard->setInteractiveTips("已有 1,234 人购买");
popularCard->setBorderRadius(12);

QObject::connect(popularCard, &ElaPopularCard::popularCardClicked, []() {
    qDebug() << "卡片被点击";
});
QObject::connect(popularCard, &ElaPopularCard::popularCardButtonClicked, []() {
    qDebug() << "购买按钮被点击";
});
```

### 11.3 ElaPromotionCard

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaPromotionCard.h` |
| **功能简介** | 促销卡片，用于 ElaPromotionView 中的轮播卡片 |
| **继承关系** | `QWidget` |
| **关键 API** | `setCardTitle/PromotionTitle/Title/SubTitle` — 文字层级<br>`setCardPixmap(QPixmap)` — 图片<br>`setCardTitleColor/PromotionTitleColor/...` — 各层文字颜色<br>`promotionCardClicked()` — 点击信号 |

```cpp
#include "ElaPromotionCard.h"

auto* promoCard = new ElaPromotionCard();
promoCard->setCardPixmap(QPixmap(":/images/banner.jpg"));
promoCard->setCardTitle("限时特惠");
promoCard->setPromotionTitle("6折优惠");
promoCard->setTitle("精英套餐");
promoCard->setSubTitle("含全部高级功能");
promoCard->setCardTitleColor(Qt::white);
promoCard->setPromotionTitleColor(QColor(255, 200, 50));
promoCard->setTitleColor(Qt::white);
promoCard->setSubTitleColor(QColor(200, 200, 200));
```

### 11.4 ElaPromotionView

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaPromotionView.h` |
| **功能简介** | 促销卡片轮播视图，支持自动滚动 |
| **继承关系** | `QWidget` |
| **关键 API** | `appendPromotionCard(ElaPromotionCard*)` — 添加卡片<br>`setIsAutoScroll(bool)` — 自动轮播<br>`setAutoScrollInterval(ms)` — 轮播间隔<br>`setCurrentIndex(int)` — 当前卡片索引 |

```cpp
#include "ElaPromotionView.h"
#include "ElaPromotionCard.h"

ElaPromotionView* promoView = new ElaPromotionView(parent);
promoView->setIsAutoScroll(true);
promoView->setAutoScrollInterval(3000);

for (int i = 0; i < 5; i++) {
    auto* card = new ElaPromotionCard();
    card->setCardPixmap(QPixmap(QString(":/images/banner%1.jpg").arg(i + 1)));
    card->setCardTitle(QString("活动 %1").arg(i + 1));
    promoView->appendPromotionCard(card);
}
```

### 11.5 ElaReminderCard

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaReminderCard.h` |
| **功能简介** | 提醒卡片，带标题、副标题和图标图片 |
| **继承关系** | `QPushButton` |
| **关键 API** | 同 ElaInteractiveCard（setTitle/SubTitle/CardPixmap 等） |

```cpp
#include "ElaReminderCard.h"

auto* reminderCard = new ElaReminderCard(parent);
reminderCard->setTitle("待办事项");
reminderCard->setSubTitle("3 项任务待完成");
reminderCard->setCardPixmap(QPixmap(":/images/reminder.png"));
reminderCard->setCardPixmapSize(40, 40);
```

### 11.6 ElaAcrylicUrlCard

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaAcrylicUrlCard.h` |
| **功能简介** | 亚克力效果链接卡片，带 URL 属性 |
| **继承关系** | `QPushButton` |
| **关键 API** | `setTitle/SubTitle/Url` — 文字和链接<br>`setCardPixmap(QPixmap)` — 图片<br>`setMainOpacity/NoiseOpacity/BrushAlpha` — 亚克力效果参数 |

```cpp
#include "ElaAcrylicUrlCard.h"

auto* urlCard = new ElaAcrylicUrlCard(parent);
urlCard->setTitle("ElaWidgetTools");
urlCard->setSubTitle("https://github.com/");
urlCard->setUrl("https://github.com/Liniyous/ElaWidgetTools");
urlCard->setCardPixmap(QPixmap(":/images/github.png"));
urlCard->setMainOpacity(0.8);
urlCard->setBorderRadius(8);
```

### 11.7 ElaImageCard

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaImageCard.h` |
| **功能简介** | 纯图片卡片，支持圆角和保留比例裁剪 |
| **继承关系** | `QWidget` |
| **关键 API** | `setCardImage(QImage)` — 设置图片<br>`setBorderRadius(int)` — 圆角<br>`setIsPreserveAspectCrop(bool)` — 保留比例裁剪 |

```cpp
#include "ElaImageCard.h"

auto* imgCard = new ElaImageCard(parent);
imgCard->setCardImage(QImage(":/images/background.jpg"));
imgCard->setBorderRadius(12);
imgCard->setIsPreserveAspectCrop(true);
imgCard->setFixedSize(300, 200);
```

---

## 十二、工具组件

### 12.1 ElaKeyBinder

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaKeyBinder.h` |
| **功能简介** | 按键绑定器，点击后捕获按键，显示按键名称并发出信号 |
| **继承关系** | `QLabel` |
| **关键 API** | `setBinderKeyText(text)` — 设置按键文字<br>`setNativeVirtualBinderKey(key)` — 设置原生虚拟键值<br>`binderKeyTextChanged(text)` — 按键文字变化信号<br>`nativeVirtualBinderKeyChanged(key)` — 虚拟键码变化信号 |

```cpp
#include "ElaKeyBinder.h"

auto* keyBinder = new ElaKeyBinder(parent);
keyBinder->setFixedSize(200, 36);
keyBinder->setBorderRadius(6);
keyBinder->setBinderKeyText("Ctrl+S");

QObject::connect(keyBinder, &ElaKeyBinder::binderKeyTextChanged, [](QString text) {
    qDebug() << "绑定的按键:" << text;
});
QObject::connect(keyBinder, &ElaKeyBinder::nativeVirtualBinderKeyChanged, [](quint32 key) {
    qDebug() << "虚拟键码:" << key;
});
```

### 12.2 ElaLog

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaLog.h` |
| **功能简介** | 日志管理器单例，可将 qDebug/qWarning/qCritical 输出重定向到文件 |
| **继承关系** | `QObject`（单例） |
| **关键 API** | `initMessageLog(bool)` — 初始化日志重定向<br>`setLogSavePath(path)` — 日志保存路径<br>`setLogFileName(name)` — 日志文件名<br>`setIsLogFileNameWithTime(bool)` — 文件名带时间戳 |

```cpp
#include "ElaLog.h"

ElaLog* log = ElaLog::getInstance();
log->setLogSavePath("./logs");
log->setLogFileName("app.log");
log->setIsLogFileNameWithTime(true);
log->initMessageLog(true);  // 启动后 qDebug() 等会写入文件
```

### 12.3 ElaDxgiManager / ElaDxgiScreen

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaDxgiManager.h` |
| **功能简介** | DXGI 屏幕捕获管理器（仅 Windows），可抓取屏幕图像 |
| **继承关系** | `QObject`（单例） |
| **关键 API** | `grabScreenToImage()` — 截屏<br>`setGrabArea(x, y, w, h)` — 设置截图区域<br>`startGrabScreen()` / `stopGrabScreen()` — 持续抓取<br>`grabImageUpdate(QImage)` — 帧更新信号<br>`setGrabFrameRate(int)` — 帧率 |

```cpp
#include "ElaDxgiManager.h"

#ifdef Q_OS_WIN
ElaDxgiManager* dxgi = ElaDxgiManager::getInstance();
dxgi->setGrabArea(0, 0, 1920, 1080);
dxgi->setGrabFrameRate(30);

QObject::connect(dxgi, &ElaDxgiManager::grabImageUpdate, [](QImage img) {
    // 处理抓取到的帧
});

dxgi->startGrabScreen();
// ...
dxgi->stopGrabScreen();
#endif

// ElaDxgiScreen — 显示抓取画面的组件
ElaDxgiScreen* dxgiScreen = new ElaDxgiScreen(parent);
dxgiScreen->setBorderRadius(8);
dxgiScreen->setIsSyncGrabSize(true);
```

### 12.4 ElaExponentialBlur

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaExponentialBlur.h` |
| **功能简介** | 指数模糊算法实现（无头文件暴露的 API，由内部使用） |

（无公开 API，主要用于 ElaWindow 和 ElaAppBar 的背景模糊效果。）

### 12.5 ElaTheme

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaTheme.h` |
| **功能简介** | 主题管理单例，控制亮色/暗色模式，提供主题色查询 |
| **继承关系** | `QObject`（单例） |
| **关键 API** | `setThemeMode(Light/Dark)` — 切换主题<br>`getThemeMode()` — 获取当前主题<br>`setThemeColor(mode, color, newColor)` — 自定义主题色<br>`getThemeColor(mode, color)` — 查询主题色<br>`drawEffectShadow(painter, rect, ...)` — 绘制阴影<br>`themeModeChanged(mode)` — 主题切换信号 |

```cpp
#include "ElaTheme.h"

// 切换为暗色模式
eTheme->setThemeMode(ElaThemeType::Dark);

// 获取当前主题色
const QColor& color = ElaThemeColor(Light, BasicText);
// 等价于：eTheme->getThemeColor(ElaThemeType::Light, ElaThemeType::BasicText);

// 监听主题变化
QObject::connect(eTheme, &ElaTheme::themeModeChanged,
    [](ElaThemeType::ThemeMode mode) {
        qDebug() << "主题已切换:" << (mode == ElaThemeType::Dark ? "暗色" : "亮色");
    });
```

### 12.6 ElaDockWidget

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaDockWidget.h` |
| **功能简介** | 现代风格停靠窗口，支持原生事件处理 |
| **继承关系** | `QDockWidget` |
| **关键 API** | 继承自 QDockWidget

```cpp
#include "ElaDockWidget.h"
#include "ElaText.h"

ElaDockWidget* dock = new ElaDockWidget("工具面板", parent);
dock->setAllowedAreas(Qt::LeftDockWidgetArea | Qt::RightDockWidgetArea);
dock->setWidget(new ElaText("这是停靠面板的内容"));
dock->setFeatures(QDockWidget::DockWidgetClosable |
                  QDockWidget::DockWidgetMovable);

// 在 ElaWindow 中添加
// window->addDockWidget(Qt::RightDockWidgetArea, dock);
```

---

## 十三、其他组件

### 13.1 ElaTableView

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaTableView.h` |
| **功能简介** | 现代风格表格视图 |
| **继承关系** | `QTableView` |
| **关键 API** | `setHeaderMargin(int)` — 表头边距<br>`tableViewShow/Hide()` — 显隐信号 |

```cpp
#include "ElaTableView.h"
#include <QStandardItemModel>

ElaTableView* tableView = new ElaTableView(parent);
tableView->setHeaderMargin(8);

auto* model = new QStandardItemModel(4, 3, this);
model->setHorizontalHeaderLabels({"名称", "类型", "大小"});
model->setItem(0, 0, new QStandardItem("文档.txt"));
model->setItem(0, 1, new QStandardItem("文本文件"));
model->setItem(0, 2, new QStandardItem("12 KB"));
// ... 填充数据
tableView->setModel(model);
tableView->setSelectionBehavior(QAbstractItemView::SelectRows);
```

### 13.2 ElaListView

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaListView.h` |
| **功能简介** | 现代风格列表视图 |
| **继承关系** | `QListView` |
| **关键 API** | `setItemHeight(int)` — 行高<br>`setIsTransparent(bool)` — 透明背景 |

```cpp
#include "ElaListView.h"
#include <QStringListModel>

ElaListView* listView = new ElaListView(parent);
listView->setItemHeight(40);
listView->setIsTransparent(false);

auto* listModel = new QStringListModel({"项目 A", "项目 B", "项目 C"}, this);
listView->setModel(listModel);
```

### 13.3 ElaTreeView

| 项目 | 内容 |
|------|------|
| **类名/头文件** | `ElaTreeView.h` |
| **功能简介** | 现代风格树视图 |
| **继承关系** | `QTreeView` |
| **关键 API** | `setItemHeight(int)` — 行高<br>`setHeaderMargin(int)` — 表头边距 |

```cpp
#include "ElaTreeView.h"
#include <QStandardItemModel>

ElaTreeView* treeView = new ElaTreeView(parent);
treeView->setItemHeight(36);
treeView->setHeaderMargin(8);

auto* treeModel = new QStandardItemModel(this);
auto* root = treeModel->invisibleRootItem();
auto* cat1 = new QStandardItem("分类一");
cat1->appendRow(new QStandardItem("子项 1-1"));
cat1->appendRow(new QStandardItem("子项 1-2"));
root->appendRow(cat1);
root->appendRow(new QStandardItem("分类二"));

treeView->setModel(treeModel);
```

---

## 附录：常用枚举值速查

### ElaMessageBarType::PositionPolicy
| 值 | 含义 |
|----|------|
| `Top` | 顶部居中 |
| `TopRight` | 右上角 |
| `TopLeft` | 左上角 |
| `Bottom` | 底部居中 |
| `BottomRight` | 右下角 |
| `BottomLeft` | 左下角 |
| `Left` | 左侧居中 |
| `Right` | 右侧居中 |

### ElaNavigationType::NavigationDisplayMode
| 值 | 含义 |
|----|------|
| `Auto` | 自动（大屏展开，小屏折叠） |
| `Minimal` | 仅图标 |
| `Compact` | 紧凑模式 |
| `Maximal` | 完全展开 |

### ElaWindowType::StackSwitchMode
| 值 | 含义 |
|----|------|
| `None` | 无动画 |
| `Popup` | 弹出效果 |
| `Scale` | 缩放效果 |
| `Flip` | 翻转效果 |
| `Blur` | 模糊过渡 |

### ElaTextType::TextStyle
| 值 | 含义 | 默认大小 |
|----|------|---------|
| `Caption` | 标注文字 | 12px |
| `Body` | 正文 | 14px |
| `BodyStrong` | 强调正文 | 14px |
| `Subtitle` | 副标题 | 20px |
| `Title` | 标题 | 28px |
| `TitleLarge` | 大标题 | 36px |
| `Display` | 展示文字 | 48px |

### ElaApplicationType::WindowDisplayMode
| 值 | 含义 |
|----|------|
| `Normal` | 普通背景 |
| `ElaMica` | Ela 云母效果 |
| `Mica` | Win11 云母（需 Win11） |
| `Acrylic` | 亚克力效果 |
| `DWMBlur` | DWM 模糊 |

### ElaThemeType::ThemeMode
| 值 | 含义 |
|----|------|
| `Light` | 亮色模式 |
| `Dark` | 暗色模式 |

---

*文档版本: v1.0 — 基于 ElaWidgetTools v2.0.3*
*Font Awesome 图标枚举 ElaIconType 包含数千个图标，详见 ElaDef.h 中的 ElaIconType::IconName 定义。*
                                         