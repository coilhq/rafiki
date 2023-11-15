terraform {
  required_version = ">= 1.6.4"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.4.0"
    }
  }
  backend "gcs" {
    bucket  = "coil-rafiki-terraform-state"
    // IF YOU COPY THIS FILE CHANGE THE PREFIX BELOW
    prefix  = "test-stacks/rafiki-test-1"
  }
}

provider "google" {
  region      = var.region 
}
