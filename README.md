<div align="center">
    <h1 align="center">diazotheme.aon2026</h1>
</div>
<div align="center">
[![PyPI](https://img.shields.io/pypi/v/diazotheme.aon2026)](https://pypi.org/project/diazotheme.aon2026/)
[![PyPI - Python Version](https://img.shields.io/pypi/pyversions/diazotheme.aon2026)](https://pypi.org/project/diazotheme.aon2026/)
[![PyPI - Wheel](https://img.shields.io/pypi/wheel/diazotheme.aon2026)](https://pypi.org/project/diazotheme.aon2026/)
[![PyPI - License](https://img.shields.io/pypi/l/diazotheme.aon2026)](https://pypi.org/project/diazotheme.aon2026/)
[![PyPI - Status](https://img.shields.io/pypi/status/diazotheme.aon2026)](https://pypi.org/project/diazotheme.aon2026/)


[![PyPI - Plone Versions](https://img.shields.io/pypi/frameworkversions/plone/diazotheme.aon2026)](https://pypi.org/project/diazotheme.aon2026/)

[![CI](https://github.com/zadok3141/diazotheme.aon2026/actions/workflows/main.yml/badge.svg)](https://github.com/zadok3141/diazotheme.aon2026/actions/workflows/main.yml)
![Code Style](https://img.shields.io/badge/Code%20Style-Black-000000)

[![GitHub contributors](https://img.shields.io/github/contributors/zadok3141/diazotheme.aon2026)](https://github.com/zadok3141/diazotheme.aon2026)
[![GitHub Repo stars](https://img.shields.io/github/stars/zadok3141/diazotheme.aon2026?style=social)](https://github.com/zadok3141/diazotheme.aon2026)

</div>

A modern, minimalist theme for Plone 6 OAG intranet site.

## Features

TODO: List our awesome features

## Installation

Install diazotheme.aon2026 with `pip`:

```shell
pip install diazotheme.aon2026
```

And to create the Plone site:

```shell
make create-site
```

## Contribute

- [Issue tracker](https://github.com/zadok3141/diazotheme.aon2026/issues)
- [Source code](https://github.com/zadok3141/diazotheme.aon2026/)

### Prerequisites ✅

-   An [operating system](https://6.docs.plone.org/install/create-project-cookieplone.html#prerequisites-for-installation) that runs all the requirements mentioned.
-   [uv](https://6.docs.plone.org/install/create-project-cookieplone.html#uv)
-   [Make](https://6.docs.plone.org/install/create-project-cookieplone.html#make)
-   [Git](https://6.docs.plone.org/install/create-project-cookieplone.html#git)
-   [Docker](https://docs.docker.com/get-started/get-docker/) (optional)

### Installation 🔧

1.  Clone this repository, then change your working directory.

    ```shell
    git clone git@github.com:zadok3141/diazotheme.aon2026.git
    cd diazotheme.aon2026
    ```

2.  Install this code base.

    ```shell
    make install
    ```


### Add features using `plonecli` or `bobtemplates.plone`

This package provides markers as strings (`<!-- extra stuff goes here -->`) that are compatible with [`plonecli`](https://github.com/plone/plonecli) and [`bobtemplates.plone`](https://github.com/plone/bobtemplates.plone).
These markers act as hooks to add all kinds of subtemplates, including behaviors, control panels, upgrade steps, or other subtemplates from `plonecli`.

To run `plonecli` with configuration to target this package, run the following command.

```shell
make add <template_name>
```

For example, you can add a content type to your package with the following command.

```shell
make add content_type
```

You can add a behavior with the following command.

```shell
make add behavior
```

```{seealso}
You can check the list of available subtemplates in the [`bobtemplates.plone` `README.md` file](https://github.com/plone/bobtemplates.plone/?tab=readme-ov-file#provided-subtemplates).
See also the documentation of [Mockup and Patternslib](https://6.docs.plone.org/classic-ui/mockup.html) for how to build the UI toolkit for Classic UI.
```

## License

The project is licensed under GPLv2.

## Credits and acknowledgements 🙏

Generated using [Cookieplone (0.9.10)](https://github.com/plone/cookieplone) and [cookieplone-templates (44f4a49)](https://github.com/plone/cookieplone-templates/commit/44f4a492fdf40acb385227b0564b7c62d22bd8d9) on 2026-02-18 14:54:36.917418. A special thanks to all contributors and supporters!
