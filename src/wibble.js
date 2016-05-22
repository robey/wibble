"use strict";

import "source-map-support/register";

import { Errors } from "./wibble/common/errors";
import { PState } from "./wibble/common/transform";

import * as desugar from "./wibble/desugar";
import * as dump from "./wibble/dump";
import * as parser from "./wibble/parser";

export { desugar, dump, Errors, parser, PState };
