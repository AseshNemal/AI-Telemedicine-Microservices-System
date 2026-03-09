package main

import "github.com/gin-gonic/gin"

func main() {

 router := gin.Default()

 router.GET("/doctors", func(c *gin.Context) {
  doctors := []string{"Dr Silva", "Dr Fernando"}
  c.JSON(200, doctors)
 })

 router.Run(":8082")
}