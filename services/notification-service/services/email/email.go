package email

import (
    "bytes"
    "encoding/json"
    "errors"
    "fmt"
    "io/ioutil"
    "net/http"
)

type Client struct {
    APIKey string
    From   string
}

func NewClient(apiKey, from string) *Client {
    return &Client{APIKey: apiKey, From: from}
}

func (c *Client) SendEmail(to, subject, message string) error {
    if c == nil {
        return errors.New("email client not configured")
    }
    if c.APIKey == "" || c.From == "" {
        return errors.New("email client missing credentials")
    }

    body := map[string]interface{}{
        "personalizations": []map[string]interface{}{
            {
                "to": []map[string]string{{"email": to}},
                "subject": subject,
            },
        },
        "from": map[string]string{"email": c.From},
        "content": []map[string]string{
            {"type": "text/plain", "value": message},
        },
    }

    b, err := json.Marshal(body)
    if err != nil {
        return err
    }

    req, err := http.NewRequest("POST", "https://api.sendgrid.com/v3/mail/send", bytes.NewReader(b))
    if err != nil {
        return err
    }
    req.Header.Set("Authorization", "Bearer "+c.APIKey)
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 400 {
        rb, _ := ioutil.ReadAll(resp.Body)
        return errors.New(fmt.Sprintf("sendgrid error: status=%d body=%s", resp.StatusCode, string(rb)))
    }
    return nil
}
