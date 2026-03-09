package notificationservice

import "github.com/gin-gonic/gin"

func main() {

	router := gin.Default()

	router.GET("/notifications", func(c *gin.Context) {
		notifications := []string{"Notification 1", "Notification 2"}
		c.JSON(200, notifications)
	})

	router.Run(":8084")
}
