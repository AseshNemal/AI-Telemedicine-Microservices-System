package main

import "github.com/gin-gonic/gin"

func main() {

 router := gin.Default()

 router.GET("/appointments", func(c *gin.Context) {
  appointments := []string{"Appointment 1", "Appointment 2"}
  c.JSON(200, appointments)
 })

 router.Run(":8083")
}